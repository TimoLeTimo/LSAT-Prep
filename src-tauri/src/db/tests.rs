use std::fs;

use rusqlite::{Connection, params};

use super::{test_support::TempDir, *};

const LATEST: i64 = migrations::ALL.len() as i64;

fn count(conn: &Connection, table: &str) -> i64 {
  conn.query_row(&format!("SELECT count(*) FROM {table}"), [], |row| row.get(0)).unwrap()
}

fn message(result: Result<Connection, DbError>) -> String {
  result.err().expect("expected a failure").to_string()
}

/// TEST DATA ONLY: one LR question with five choices.
fn add_question(conn: &mut Connection, id: &str) -> rusqlite::Result<()> {
  let tx = conn.transaction()?;
  tx.execute(
    "INSERT OR IGNORE INTO content_packages VALUES ('test', '1.0.0', 1, 'Test', 'now', 'now', NULL)",
    [],
  )?;
  tx.execute(
    "INSERT INTO questions VALUES (?1, 'logical_reasoning', 'lr-flaw', 2, 'Test', 'Test', ?1 || ':C',
     90, NULL, 1, 'approved', '{}', '{}', 'test', '1.0.0', 'now', 'now')",
    [id],
  )?;
  for (order, label) in ["A", "B", "C", "D", "E"].iter().enumerate() {
    tx.execute(
      "INSERT INTO answer_choices VALUES (?1 || ':' || ?2, ?1, ?2, 'Test', 'Test', ?3)",
      params![id, label, order as i64],
    )?;
  }
  tx.commit()
}

/// One submitted answer to question `q1`.
fn add_attempt(conn: &Connection) {
  conn
    .execute_batch(
      "INSERT INTO practice_sessions (id, session_type, configuration_json, status, created_at)
         VALUES ('s1', 'targeted', '{}', 'in_progress', 'now');
       INSERT INTO session_questions (id, session_id, question_id, display_order, selected_choice_id, content_snapshot_json)
         VALUES ('sq1', 's1', 'q1', 0, 'q1:A', '{\"prompt\":\"as shown\"}');
       INSERT INTO attempts VALUES ('a1', 'sq1', 's1', 'q1', 'q1:A', 0, 30, 'now', 'original');",
    )
    .unwrap();
}

fn database_with_attempt(dir: &TempDir) -> Connection {
  let mut conn = open(&dir.0).unwrap();
  add_question(&mut conn, "q1").unwrap();
  add_attempt(&conn);
  conn
}

// ---------------------------------------------------------------- Opening and upgrading

#[test]
fn creates_a_new_database_with_settings_and_categories() {
  let dir = TempDir::new();
  let conn = open(&dir.0).unwrap();
  let pragma = |name: &str| -> String {
    conn
      .query_row(&format!("PRAGMA {name}"), [], |row| {
        row.get::<_, rusqlite::types::Value>(0).map(|value| format!("{value:?}"))
      })
      .unwrap()
  };
  assert_eq!(pragma("user_version"), format!("Integer({})", migrations::ALL.len()));
  assert_eq!(pragma("foreign_keys"), "Integer(1)");
  assert_eq!(pragma("synchronous"), "Integer(2)");
  assert_eq!(pragma("journal_mode"), "Text(\"wal\")");
  assert_eq!(count(&conn, "question_categories"), 28);
  assert!(dir.backups().is_empty());
}

#[test]
fn reopening_keeps_data_and_makes_no_backup() {
  let dir = TempDir::new();
  drop(database_with_attempt(&dir));
  let conn = open(&dir.0).unwrap();
  assert_eq!(count(&conn, "attempts"), 1);
  assert_eq!(count(&conn, "question_categories"), 28);
  assert!(dir.backups().is_empty());
}

#[test]
fn upgrade_keeps_data_and_backs_up_first() {
  let dir = TempDir::new();
  drop(database_with_attempt(&dir));
  let next = [migrations::ALL, &["CREATE TABLE added (x TEXT) STRICT;"]].concat();
  let conn = open_with(&dir.0, &next).unwrap();
  assert_eq!(migrations::version(&conn).unwrap(), LATEST + 1);
  assert_eq!(count(&conn, "attempts"), 1);
  assert_eq!(count(&conn, "added"), 0);

  let backups = dir.backups();
  assert_eq!(backups.len(), 1);
  assert_eq!(backups[0].extension().unwrap(), "db");
  let backup = Connection::open(&backups[0]).unwrap();
  assert_eq!(migrations::version(&backup).unwrap(), LATEST);
  assert_eq!(count(&backup, "attempts"), 1);
}

#[test]
fn a_backup_restores_to_a_clean_folder() {
  let dir = TempDir::new();
  drop(database_with_attempt(&dir));
  let next = [migrations::ALL, &["DROP TABLE bookmarks;"]].concat();
  drop(open_with(&dir.0, &next).unwrap());

  let clean = TempDir::new();
  fs::copy(&dir.backups()[0], clean.file()).unwrap();
  let conn = open(&clean.0).unwrap();
  assert_eq!(count(&conn, "attempts"), 1);
  assert_eq!(count(&conn, "bookmarks"), 0);
}

#[test]
fn a_failed_upgrade_changes_nothing() {
  let dir = TempDir::new();
  drop(database_with_attempt(&dir));
  // The first new migration works and the second fails: both must be undone.
  let bad = [migrations::ALL, &["CREATE TABLE added (x TEXT);", "INSERT INTO missing VALUES (1);"]].concat();
  assert!(open_with(&dir.0, &bad).is_err());

  let conn = open(&dir.0).unwrap();
  assert_eq!(migrations::version(&conn).unwrap(), LATEST);
  assert_eq!(count(&conn, "attempts"), 1);
  let added: i64 = conn
    .query_row("SELECT count(*) FROM sqlite_schema WHERE name = 'added'", [], |row| row.get(0))
    .unwrap();
  assert_eq!(added, 0);
}

#[test]
fn a_failed_first_setup_can_be_retried() {
  let dir = TempDir::new();
  assert!(open_with(&dir.0, &["CREATE TABLE t (x TEXT); NOT SQL;"]).is_err());
  assert_eq!(count(&open(&dir.0).unwrap(), "question_categories"), 28);
}

#[test]
fn no_upgrade_without_a_backup() {
  let dir = TempDir::new();
  drop(database_with_attempt(&dir));
  fs::write(dir.0.join("backups"), "blocks the folder").unwrap();
  let next = [migrations::ALL, &["CREATE TABLE added (x TEXT);"]].concat();
  assert!(message(open_with(&dir.0, &next)).contains("nothing was changed"));
  fs::remove_file(dir.0.join("backups")).unwrap();
  assert_eq!(migrations::version(&open(&dir.0).unwrap()).unwrap(), LATEST);
}

#[test]
fn upgrades_every_released_version_and_keeps_its_data() {
  for released in 1..migrations::ALL.len() {
    let dir = TempDir::new();
    let mut conn = open_with(&dir.0, &migrations::ALL[..released]).unwrap();
    add_question(&mut conn, "q1").unwrap();
    add_attempt(&conn);
    drop(conn);
    let conn = open(&dir.0).unwrap();
    assert_eq!(migrations::version(&conn).unwrap(), LATEST);
    assert_eq!((count(&conn, "attempts"), count(&conn, "session_questions")), (1, 1));
    let active: i64 =
      conn.query_row("SELECT active_ms FROM practice_sessions", [], |row| row.get(0)).unwrap();
    assert_eq!(active, 0);
    assert_eq!(dir.backups().len(), 1);
  }
}

// ---------------------------------------------------------------- Files it must refuse

#[test]
fn refuses_newer_data_without_changing_it() {
  let dir = TempDir::new();
  let next = [migrations::ALL, &["CREATE TABLE added (x TEXT);"]].concat();
  drop(open_with(&dir.0, &next).unwrap());
  let before = fs::read(dir.file()).unwrap();
  assert!(message(open(&dir.0)).contains("newer version"));
  assert_eq!(fs::read(dir.file()).unwrap(), before);
}

#[test]
fn refuses_another_programs_database_without_changing_it() {
  let dir = TempDir::new();
  Connection::open(dir.file()).unwrap().execute_batch("CREATE TABLE theirs (x TEXT);").unwrap();
  let before = fs::read(dir.file()).unwrap();
  assert!(message(open(&dir.0)).contains("not created by LSAT Prep"));
  assert_eq!(fs::read(dir.file()).unwrap(), before);
}

#[test]
fn refuses_a_file_that_is_not_a_database() {
  let dir = TempDir::new();
  fs::write(dir.file(), "this is not a database ".repeat(100)).unwrap();
  let before = fs::read(dir.file()).unwrap();
  assert!(message(open(&dir.0)).contains("damaged"));
  assert_eq!(fs::read(dir.file()).unwrap(), before);
}

#[test]
fn detects_damage_inside_the_file() {
  let dir = TempDir::new();
  let conn = database_with_attempt(&dir);
  // Damage only the attempts table, which nothing else reads while opening.
  let page = |sql: &str| -> usize { conn.query_row(sql, [], |row| row.get::<_, i64>(0)).unwrap() as usize };
  let size = page("PRAGMA page_size");
  let root = page("SELECT rootpage FROM sqlite_schema WHERE name = 'attempts'");
  drop(conn);
  let mut bytes = fs::read(dir.file()).unwrap();
  bytes[(root - 1) * size..root * size].fill(0xAB);
  fs::write(dir.file(), bytes).unwrap();
  assert!(message(open(&dir.0)).contains("damaged"));
}

// ---------------------------------------------------------------- Content rules

#[test]
fn accepts_a_complete_question() {
  let dir = TempDir::new();
  let mut conn = open(&dir.0).unwrap();
  add_question(&mut conn, "q1").unwrap();
  assert_eq!(count(&conn, "answer_choices"), 5);
}

#[test]
fn rejects_content_that_breaks_the_rules() {
  let dir = TempDir::new();
  let mut conn = open(&dir.0).unwrap();
  add_question(&mut conn, "q1").unwrap();
  add_question(&mut conn, "q2").unwrap();
  for sql in [
    "UPDATE questions SET correct_choice_id = 'q2:C' WHERE id = 'q1'",
    "UPDATE questions SET correct_choice_id = 'missing' WHERE id = 'q1'",
    "UPDATE questions SET category_id = 'rc-detail' WHERE id = 'q1'",
    "UPDATE questions SET category_id = 'missing' WHERE id = 'q1'",
    "UPDATE questions SET stimulus = NULL WHERE id = 'q1'",
    "UPDATE questions SET section = 'reading_comprehension' WHERE id = 'q1'",
    "UPDATE questions SET difficulty = 5 WHERE id = 'q1'",
    "UPDATE questions SET status = 'unknown' WHERE id = 'q1'",
    "UPDATE questions SET quality_json = 'not json' WHERE id = 'q1'",
    "UPDATE questions SET package_version = '9.9.9' WHERE id = 'q1'",
    "UPDATE answer_choices SET choice_label = 'A' WHERE id = 'q1:B'",
    "DELETE FROM answer_choices WHERE id = 'q1:C'",
    "DELETE FROM question_categories WHERE id = 'lr-flaw'",
  ] {
    assert!(conn.execute(sql, []).is_err(), "should be rejected: {sql}");
  }
}

// ---------------------------------------------------------------- User history

#[test]
fn retiring_a_question_keeps_its_history() {
  let dir = TempDir::new();
  let conn = database_with_attempt(&dir);
  conn.execute("UPDATE questions SET status = 'retired', prompt = 'revised' WHERE id = 'q1'", []).unwrap();
  let shown: String = conn
    .query_row(
      "SELECT content_snapshot_json ->> 'prompt' FROM session_questions WHERE id = 'sq1'",
      [],
      |row| row.get(0),
    )
    .unwrap();
  assert_eq!(shown, "as shown");
  assert_eq!(count(&conn, "attempts"), 1);
}

#[test]
fn protects_history() {
  let dir = TempDir::new();
  let mut conn = database_with_attempt(&dir);
  add_question(&mut conn, "q2").unwrap();
  for sql in [
    // Deleting things that history depends on.
    "DELETE FROM questions WHERE id = 'q1'",
    "DELETE FROM answer_choices WHERE id = 'q1:A'",
    "DELETE FROM session_questions WHERE id = 'sq1'",
    "DELETE FROM practice_sessions WHERE id = 's1'",
    "DELETE FROM content_packages",
    // Rewriting history.
    "UPDATE attempts SET is_correct = 1",
    "UPDATE session_questions SET content_snapshot_json = '{}'",
    // Inconsistent answers.
    "INSERT INTO attempts VALUES ('a2', 'sq1', 's1', 'q1', 'q1:B', 0, 1, 'now', 'original')",
    "INSERT INTO attempts VALUES ('a2', 'sq9', 's1', 'q1', 'q1:B', 0, 1, 'now', 'original')",
    "UPDATE session_questions SET selected_choice_id = 'q2:A'",
  ] {
    assert!(conn.execute(sql, []).is_err(), "should be rejected: {sql}");
  }
  assert_eq!(count(&conn, "attempts"), 1);
}

#[test]
fn a_selection_can_change_before_it_is_submitted() {
  let dir = TempDir::new();
  let conn = database_with_attempt(&dir);
  conn
    .execute("UPDATE session_questions SET selected_choice_id = 'q1:B', is_flagged = 1", [])
    .unwrap();
}

#[test]
fn saved_work_survives_without_a_clean_close() {
  let dir = TempDir::new();
  let conn = database_with_attempt(&dir);
  // Copy the live files, as they would be on disk after a crash.
  let after = TempDir::new();
  for entry in fs::read_dir(&dir.0).unwrap() {
    let path = entry.unwrap().path();
    if path.extension().unwrap() != "db-shm" {
      fs::copy(&path, after.0.join(path.file_name().unwrap())).unwrap();
    }
  }
  assert_eq!(count(&open(&after.0).unwrap(), "attempts"), 1);
  drop(conn);
}

#[test]
fn after_a_normal_close_the_database_file_is_complete_by_itself() {
  let dir = TempDir::new();
  let conn = database_with_attempt(&dir);
  let copy_alone = || {
    let alone = TempDir::new();
    fs::copy(dir.file(), alone.file()).unwrap();
    open(&alone.0).map(|conn| count(&conn, "attempts"))
  };
  assert_ne!(copy_alone().ok(), Some(1), "the side file is still needed while open");
  tidy(&conn).unwrap();
  assert_eq!(copy_alone().unwrap(), 1);
  // The connection still works afterward.
  add_question_tag(&conn);
}

fn add_question_tag(conn: &Connection) {
  conn.execute("INSERT INTO question_tags VALUES ('q1', 'tag')", []).unwrap();
}
