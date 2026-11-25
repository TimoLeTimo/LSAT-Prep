use std::fs;

use rusqlite::Connection;

use super::{backup::*, test_support::TempDir, *};

const LATEST: i64 = migrations::ALL.len() as i64;

fn bookmarked(conn: &Connection) -> Vec<String> {
  conn
    .prepare("SELECT question_id FROM bookmarks ORDER BY 1")
    .unwrap()
    .query_map([], |row| row.get(0))
    .unwrap()
    .collect::<rusqlite::Result<_>>()
    .unwrap()
}

/// TEST DATA ONLY: one question, bookmarked, and an unfinished session.
fn fill(conn: &mut Connection, id: &str) {
  let tx = conn.transaction().unwrap();
  tx.execute_batch(&format!(
    "INSERT OR IGNORE INTO content_packages VALUES ('p', '1.0.0', 1, 'Test', 'now', 'now', NULL);
     INSERT INTO questions VALUES ('{id}', 'logical_reasoning', 'lr-flaw', 2, 'T', 'T', '{id}:A',
       90, NULL, 1, 'approved', '{{}}', '{{}}', 'p', '1.0.0', 'now', 'now');
     INSERT INTO answer_choices VALUES ('{id}:A', '{id}', 'A', 'T', 'T', 0);
     INSERT INTO bookmarks VALUES ('b-{id}', '{id}', '', 'now');
     INSERT INTO practice_sessions (id, session_type, configuration_json, status, created_at)
       VALUES ('s-{id}', 'targeted', '{{}}', 'in_progress', '2026-01-01');"
  ))
  .unwrap();
  tx.commit().unwrap();
}

struct Setup {
  data: TempDir,
  elsewhere: TempDir,
  conn: Connection,
}

/// Data with question "old", a backup of it, and then question "new" as well.
fn setup() -> (Setup, std::path::PathBuf) {
  let (data, elsewhere) = (TempDir::new(), TempDir::new());
  let mut conn = open(&data.0).unwrap();
  fill(&mut conn, "old");
  let file = elsewhere.0.join("mine.db");
  export(&conn, &data.0, &file).unwrap();
  fill(&mut conn, "new");
  (Setup { data, elsewhere, conn }, file)
}

fn reason<T: std::fmt::Debug>(result: Result<T, DbError>) -> String {
  explain(&result.expect_err("expected a failure"))
}

fn has_staging(setup: &Setup) -> bool {
  setup.data.0.join("restore").exists()
}

// ---------------------------------------------------------------- Backing up

#[test]
fn a_backup_is_one_complete_file() {
  let (setup, file) = setup();
  let names: Vec<_> =
    fs::read_dir(&setup.elsewhere.0).unwrap().map(|entry| entry.unwrap().file_name()).collect();
  assert_eq!(names, ["mine.db"], "no side or partial files");
  let copy = Connection::open(&file).unwrap();
  assert_eq!(bookmarked(&copy), ["old"]);
  assert_eq!(bookmarked(&setup.conn), ["new", "old"], "the live data is unchanged");
}

#[test]
fn replacing_a_backup_is_safe() {
  let (setup, file) = setup();
  export(&setup.conn, &setup.data.0, &file).unwrap();
  assert_eq!(bookmarked(&Connection::open(&file).unwrap()), ["new", "old"]);
  // A failure leaves the existing file alone.
  let before = fs::read(&file).unwrap();
  fs::create_dir(setup.elsewhere.0.join("mine.db.partial")).unwrap();
  assert!(export(&setup.conn, &setup.data.0, &file).is_err());
  assert_eq!(fs::read(&file).unwrap(), before);
}

#[test]
fn a_backup_cannot_go_over_the_live_data() {
  let (setup, _) = setup();
  for name in ["lsat-prep.db", "lsat-prep.db-wal", "other.db"] {
    let result = export(&setup.conn, &setup.data.0, &setup.data.0.join(name));
    assert!(reason(result).contains("other than"));
  }
  assert_eq!(bookmarked(&setup.conn), ["new", "old"]);
  let missing = setup.elsewhere.0.join("missing").join("x.db");
  assert!(export(&setup.conn, &setup.data.0, &missing).is_err());
}

// ---------------------------------------------------------------- Restoring

#[test]
fn restores_everything_and_keeps_a_backup_of_what_it_replaced() {
  let (mut setup, file) = setup();
  let original = fs::read(&file).unwrap();
  let found = stage(&setup.data.0, &file).unwrap();
  assert_eq!((found.questions, found.bookmarks, found.unfinished_sessions), (1, 1, 1));
  assert_eq!(found.last_activity.as_deref(), Some("2026-01-01"));
  assert_eq!(bookmarked(&setup.conn), ["new", "old"], "choosing changes nothing");

  let name = restore(&mut setup.conn, &setup.data.0).unwrap();
  assert!(name.starts_with("before-restore-") && name.ends_with(".db"));
  assert_eq!(bookmarked(&setup.conn), ["old"]);
  assert_eq!(summary(&setup.conn).unwrap(), found);
  assert!(!has_staging(&setup));
  assert_eq!(fs::read(&file).unwrap(), original, "the backup itself is only read");

  // Still works, survives reopening, and can be undone.
  fill(&mut setup.conn, "later");
  let data = setup.data.0.clone();
  drop(setup.conn);
  let mut conn = open(&data).unwrap();
  assert_eq!(bookmarked(&conn), ["later", "old"]);
  stage(&data, &data.join("backups").join(name)).unwrap();
  restore(&mut conn, &data).unwrap();
  assert_eq!(bookmarked(&conn), ["new", "old"]);
  let mode: String = conn.query_row("PRAGMA journal_mode", [], |row| row.get(0)).unwrap();
  assert_eq!(mode, "wal");
}

#[test]
fn restores_every_older_version() {
  for version in 1..=migrations::ALL.len() {
    let (mut setup, _) = setup();
    let old = TempDir::new();
    let mut conn = open_with(&old.0, &migrations::ALL[..version]).unwrap();
    fill(&mut conn, "ancient");
    let file = setup.elsewhere.0.join("ancient.db");
    export(&conn, &old.0, &file).unwrap();
    stage(&setup.data.0, &file).unwrap();
    restore(&mut setup.conn, &setup.data.0).unwrap();
    assert_eq!(bookmarked(&setup.conn), ["ancient"]);
    assert_eq!(migrations::version(&setup.conn).unwrap(), LATEST);
  }
}

#[test]
fn includes_recent_changes_from_a_side_file() {
  let (mut setup, _) = setup();
  let live = TempDir::new();
  let mut conn = open(&live.0).unwrap();
  fill(&mut conn, "recent");
  for suffix in ["", "-wal"] {
    let from = live.0.join(format!("lsat-prep.db{suffix}"));
    fs::copy(from, setup.elsewhere.0.join(format!("copied.db{suffix}"))).unwrap();
  }
  stage(&setup.data.0, &setup.elsewhere.0.join("copied.db")).unwrap();
  restore(&mut setup.conn, &setup.data.0).unwrap();
  assert_eq!(bookmarked(&setup.conn), ["recent"]);
}

#[test]
fn refuses_files_that_are_not_good_backups() {
  let (mut setup, file) = setup();
  let at = |name: &str| setup.elsewhere.0.join(name);
  fs::write(at("text.db"), "not a database ".repeat(500)).unwrap();
  fs::write(at("empty.db"), "").unwrap();
  Connection::open(at("other.db")).unwrap().execute_batch("CREATE TABLE x (y)").unwrap();
  let mut bytes = fs::read(&file).unwrap();
  for byte in &mut bytes[4096 * 6..4096 * 7] {
    *byte = 0xAB;
  }
  fs::write(at("damaged.db"), &bytes).unwrap();
  let altered = |name: &str, sql: &str| {
    fs::copy(&file, at(name)).unwrap();
    Connection::open(at(name)).unwrap().execute_batch(sql).unwrap();
  };
  altered("newer.db", "PRAGMA user_version = 99");
  altered("zero.db", "PRAGMA user_version = 0");
  altered("orphan.db", "PRAGMA foreign_keys = OFF; DELETE FROM questions");
  for (name, expected) in [
    ("text.db", "not an LSAT Prep backup"),
    ("empty.db", "not an LSAT Prep backup"),
    ("other.db", "not an LSAT Prep backup"),
    ("damaged.db", "damaged"),
    ("newer.db", "newer version"),
    ("zero.db", "not an LSAT Prep backup"),
    ("orphan.db", "damaged"),
    ("missing.db", "could not be read"),
    ("", "not a folder"),
  ] {
    let message = reason(stage(&setup.data.0, &at(name)));
    assert!(message.contains(expected), "{name}: {message}");
    assert!(!has_staging(&setup), "{name}");
    assert!(reason(restore(&mut setup.conn, &setup.data.0)).contains("Choose a backup first"));
  }
  assert_eq!(bookmarked(&setup.conn), ["new", "old"]);
  assert!(!setup.data.0.join("backups").exists());
}

#[test]
fn refuses_hidden_code_and_altered_structure() {
  let (setup, file) = setup();
  for (index, sql) in [
    "CREATE TRIGGER evil AFTER INSERT ON bookmarks BEGIN DELETE FROM attempts; END",
    "CREATE VIEW evil AS SELECT 1",
    "CREATE TABLE extra (x)",
    "DROP TRIGGER attempts_are_permanent",
    "DROP INDEX attempts_by_date",
    "ALTER TABLE bookmarks ADD COLUMN extra TEXT",
    "PRAGMA writable_schema = ON; UPDATE sqlite_schema SET sql = replace(sql, 'RESTRICT', 'CASCADE') WHERE name = 'attempts'",
    "DROP TABLE app_settings; CREATE VIEW app_settings AS SELECT 1 AS key",
  ]
  .into_iter()
  .enumerate()
  {
    let altered = setup.elsewhere.0.join(format!("altered{index}.db"));
    fs::copy(&file, &altered).unwrap();
    Connection::open(&altered).unwrap().execute_batch(sql).unwrap();
    let message = reason(stage(&setup.data.0, &altered));
    assert!(message.contains("structure"), "{sql}: {message}");
    assert!(!has_staging(&setup));
  }
}

#[test]
fn a_failed_restore_changes_nothing() {
  let (mut setup, file) = setup();
  // No backup of the current data can be made.
  stage(&setup.data.0, &file).unwrap();
  fs::write(setup.data.0.join("backups"), "blocks the folder").unwrap();
  assert!(reason(restore(&mut setup.conn, &setup.data.0)).contains("nothing was changed"));
  assert_eq!(bookmarked(&setup.conn), ["new", "old"]);
  fs::remove_file(setup.data.0.join("backups")).unwrap();

  // The copy itself fails, because another connection is reading or writing.
  let other = Connection::open(setup.data.0.join(FILE_NAME)).unwrap();
  other.execute_batch("BEGIN IMMEDIATE; DELETE FROM bookmarks WHERE 0").unwrap();
  setup.conn.busy_timeout(std::time::Duration::ZERO).unwrap();
  assert!(restore(&mut setup.conn, &setup.data.0).is_err());
  other.execute_batch("ROLLBACK").unwrap();
  assert_eq!(bookmarked(&setup.conn), ["new", "old"]);
  // And it can be tried again.
  restore(&mut setup.conn, &setup.data.0).unwrap();
  assert_eq!(bookmarked(&setup.conn), ["old"]);
}

#[test]
fn choosing_again_or_cancelling_discards_the_earlier_choice() {
  let (mut setup, file) = setup();
  stage(&setup.data.0, &file).unwrap();
  assert!(stage(&setup.data.0, &setup.elsewhere.0.join("missing.db")).is_err());
  assert!(restore(&mut setup.conn, &setup.data.0).is_err());
  stage(&setup.data.0, &file).unwrap();
  clear_staging(&setup.data.0);
  assert!(restore(&mut setup.conn, &setup.data.0).is_err());
}

// ---------------------------------------------------------------- Unreadable data

#[test]
fn restores_over_unreadable_data_and_keeps_it() {
  let (setup, file) = setup();
  let data = setup.data.0.clone();
  drop(setup.conn);
  let live = data.join(FILE_NAME);
  fs::write(&live, "ruined ".repeat(2000)).unwrap();
  let ruined = fs::read(&live).unwrap();
  assert!(open(&data).is_err());

  stage(&data, &file).unwrap();
  let (conn, name) = restore_over_unreadable(&data).unwrap();
  assert_eq!(bookmarked(&conn), ["old"]);
  assert_eq!(fs::read(data.join("backups").join(name).join(FILE_NAME)).unwrap(), ruined);
  drop(conn);
  assert_eq!(bookmarked(&open(&data).unwrap()), ["old"]);
}

#[test]
fn a_failed_restore_over_unreadable_data_puts_it_back() {
  let (setup, file) = setup();
  let data = setup.data.0.clone();
  drop(setup.conn);
  fs::write(data.join(FILE_NAME), "ruined ".repeat(2000)).unwrap();
  stage(&data, &file).unwrap();
  // Ruin the staged copy after it was checked.
  fs::write(data.join("restore").join(FILE_NAME), "also ruined ".repeat(900)).unwrap();
  assert!(restore_over_unreadable(&data).is_err());
  assert_eq!(fs::read_to_string(data.join(FILE_NAME)).unwrap(), "ruined ".repeat(2000));
  assert_eq!(fs::read_dir(data.join("backups")).unwrap().count(), 0);
}

// ---------------------------------------------------------------- One copy at a time

#[test]
fn only_one_copy_can_use_the_data() {
  let dir = TempDir::new();
  let first = lock(&dir.0).unwrap();
  assert!(lock(&dir.0).unwrap_err().to_string().contains("already open"));
  lock(&TempDir::new().0).unwrap();
  drop(first);
  lock(&dir.0).unwrap();
}

#[test]
fn a_failed_backup_leaves_no_partial_file() {
  let (setup, _) = setup();
  // The copy is written, but cannot take the place of a folder with something in it.
  let blocked = setup.elsewhere.0.join("folder.db");
  fs::create_dir_all(blocked.join("inside")).unwrap();
  assert!(export(&setup.conn, &setup.data.0, &blocked).is_err());
  assert!(!setup.elsewhere.0.join("folder.db.partial").exists());
}
