use std::path::Path;

use rusqlite::Connection;
use serde_json::{Value, json};

use super::*;
use crate::db::{self, test_support::TempDir};

/// Shared with the TypeScript validator tests. TEST DATA ONLY.
const VALID: &str = include_str!("../../../tests/fixtures/valid-package.json");

const USER_TABLES: [&str; 6] = [
  "practice_sessions",
  "session_questions",
  "attempts",
  "bookmarks",
  "saved_practice_templates",
  "app_settings",
];
const CONTENT_TABLES: [&str; 7] = [
  "question_categories",
  "content_packages",
  "passages",
  "passage_texts",
  "questions",
  "answer_choices",
  "question_tags",
];

fn edited(edit: impl Fn(&mut Value)) -> Vec<u8> {
  let mut value: Value = serde_json::from_str(VALID).unwrap();
  edit(&mut value);
  serde_json::to_vec(&value).unwrap()
}

/// A second package with one new question.
fn second_package(edit: impl Fn(&mut Value)) -> Vec<u8> {
  edited(|value| {
    value["package_id"] = json!("second-package");
    value["questions"][0]["id"] = json!("test-lr-2");
    edit(value);
  })
}

fn open(dir: &TempDir) -> Connection {
  db::open(Path::new(&dir.0)).unwrap()
}

fn import_now(conn: &mut Connection, bytes: &[u8]) -> Result<Plan, ImportError> {
  let plan = preview(conn, bytes)?;
  import(conn, bytes, &plan)
}

/// A database with imported content and one of every kind of user activity.
fn database_in_use(dir: &TempDir) -> Connection {
  let mut conn = open(dir);
  import_now(&mut conn, VALID.as_bytes()).unwrap();
  conn
    .execute_batch(
      "INSERT INTO practice_sessions (id, session_type, configuration_json, status, created_at)
         VALUES ('s1', 'targeted', '{}', 'in_progress', 'now');
       INSERT INTO session_questions (id, session_id, question_id, display_order, selected_choice_id, content_snapshot_json)
         VALUES ('sq1', 's1', 'test-lr-1', 0, 'test-lr-1:A', '{}');
       INSERT INTO attempts VALUES ('a1', 'sq1', 's1', 'test-lr-1', 'test-lr-1:A', 0, 30, 'now', 'original');
       INSERT INTO bookmarks VALUES ('b1', 'test-lr-1', 'note', 'now');
       INSERT INTO saved_practice_templates VALUES ('t1', 'Mine', '{}', 'now', 'now');
       INSERT INTO app_settings VALUES ('theme', '\"light\"', 'now');",
    )
    .unwrap();
  conn
}

/// Every value in the given tables, for before-and-after comparison.
fn dump(conn: &Connection, tables: &[&str]) -> Vec<String> {
  let mut rows = Vec::new();
  for table in tables {
    let mut statement = conn.prepare(&format!("SELECT * FROM {table} ORDER BY rowid")).unwrap();
    let columns = statement.column_count();
    let mut found = statement.query([]).unwrap();
    while let Some(row) = found.next().unwrap() {
      let values: Vec<_> =
        (0..columns).map(|index| row.get::<_, rusqlite::types::Value>(index).unwrap()).collect();
      rows.push(format!("{table}: {values:?}"));
    }
  }
  rows
}

fn statuses(conn: &Connection) -> Vec<String> {
  list_history(conn).unwrap().into_iter().map(|entry| entry.status).collect()
}

fn reasons(result: Result<Plan, ImportError>) -> String {
  match result {
    Err(ImportError::Refused(reasons)) => reasons.join("\n"),
    other => panic!("expected a refusal, got {other:?}"),
  }
}

// ---------------------------------------------------------------- Successful imports

#[test]
fn preview_writes_nothing() {
  let dir = TempDir::new();
  let mut conn = open(&dir);
  let before = dump(&conn, &CONTENT_TABLES);
  let plan = preview(&mut conn, VALID.as_bytes()).unwrap();
  assert_eq!((plan.lr_questions, plan.rc_questions), (1, 1));
  assert_eq!(plan.questions.new, ["test-lr-1", "test-rc-1"]);
  assert_eq!(plan.passages.new, ["test-passage-1"]);
  assert_eq!(plan.categories.new, ["test-category"]);
  assert_eq!(plan.questions_by_category.len(), 2);
  assert!(plan.problems.is_empty());
  assert_eq!(dump(&conn, &CONTENT_TABLES), before);
  assert!(statuses(&conn).is_empty());
}

#[test]
fn stores_exactly_what_the_file_contains() {
  let dir = TempDir::new();
  let mut conn = open(&dir);
  import_now(&mut conn, VALID.as_bytes()).unwrap();
  let package = package::read(VALID.as_bytes()).unwrap();
  for question in &package.questions {
    assert_eq!(store::load_question(&conn, &question.id).unwrap().as_ref(), Some(question));
  }
  for passage in &package.passages {
    assert_eq!(store::load_passage(&conn, &passage.id).unwrap().as_ref(), Some(passage));
  }
  for category in &package.categories {
    assert_eq!(store::load_category(&conn, &category.id).unwrap().as_ref(), Some(category));
  }
  let entry = &list_history(&conn).unwrap()[0];
  assert_eq!(entry.status, "succeeded");
  assert_eq!((entry.questions_added, entry.passages_added, entry.categories_added), (2, 1, 1));
}

#[test]
fn skips_identical_items_and_adds_new_ones() {
  let dir = TempDir::new();
  let mut conn = database_in_use(&dir);
  let plan = import_now(&mut conn, &second_package(|_| ())).unwrap();
  assert_eq!(plan.questions.new, ["test-lr-2"]);
  assert_eq!(plan.questions.skipped, ["test-rc-1"]);
  assert_eq!(plan.passages.skipped, ["test-passage-1"]);
  assert_eq!(plan.categories.skipped, ["test-category"]);
  let entry = &list_history(&conn).unwrap()[0];
  assert_eq!((entry.questions_added, entry.duplicates_skipped), (1, 3));
}

#[test]
fn tag_order_does_not_matter() {
  let dir = TempDir::new();
  let mut conn = open(&dir);
  let tags = |tags: Value| {
    move |value: &mut Value| value["questions"][1]["secondary_tags"] = tags.clone()
  };
  import_now(&mut conn, &edited(tags(json!(["a", "b"])))).unwrap();
  let plan = preview(&mut conn, &second_package(tags(json!(["b", "a"])))).unwrap();
  assert_eq!(plan.questions.skipped, ["test-rc-1"]);
}

#[test]
fn accepts_a_passage_already_in_the_app() {
  let dir = TempDir::new();
  let mut conn = database_in_use(&dir);
  let bytes = second_package(|value| {
    value["passages"] = json!([]);
    value["questions"][1]["id"] = json!("test-rc-2");
  });
  assert_eq!(import_now(&mut conn, &bytes).unwrap().questions.new.len(), 2);
}

#[test]
fn a_retired_question_stays_retired() {
  let dir = TempDir::new();
  let mut conn = database_in_use(&dir);
  conn.execute("UPDATE questions SET status = 'retired' WHERE id = 'test-rc-1'", []).unwrap();
  let plan = import_now(&mut conn, &second_package(|_| ())).unwrap();
  assert_eq!(plan.questions.skipped, ["test-rc-1"]);
  let status: String = conn
    .query_row("SELECT status FROM questions WHERE id = 'test-rc-1'", [], |row| row.get(0))
    .unwrap();
  assert_eq!(status, "retired");
}

// ---------------------------------------------------------------- Refusals

#[test]
fn refuses_a_version_that_is_already_imported() {
  let dir = TempDir::new();
  let mut conn = database_in_use(&dir);
  assert!(reasons(import_now(&mut conn, VALID.as_bytes())).contains("already been imported"));
  // Even if the content differs.
  let bytes = edited(|value| value["questions"][0]["id"] = json!("test-lr-2"));
  assert!(reasons(import_now(&mut conn, &bytes)).contains("already been imported"));
}

#[test]
fn refuses_a_package_with_nothing_new() {
  let dir = TempDir::new();
  let mut conn = database_in_use(&dir);
  let bytes = edited(|value| value["package_version"] = json!("1.0.1"));
  assert!(reasons(import_now(&mut conn, &bytes)).contains("already in the app"));
}

#[test]
fn refuses_different_content_under_an_existing_id() {
  let dir = TempDir::new();
  let mut conn = database_in_use(&dir);
  let before = dump(&conn, &CONTENT_TABLES);
  let edits: [(&str, &str, Value); 17] = [
    ("/questions/1/prompt", "test-rc-1", json!("changed")),
    ("/questions/1/difficulty", "test-rc-1", json!(3)),
    ("/questions/1/primary_category", "test-rc-1", json!("rc-structure")),
    ("/questions/1/secondary_tags", "test-rc-1", json!([])),
    ("/questions/1/choices/4/text", "test-rc-1", json!("changed")),
    ("/questions/1/correct_choice", "test-rc-1", json!("D")),
    ("/questions/1/explanations/E", "test-rc-1", json!("changed")),
    ("/questions/1/estimated_time_seconds", "test-rc-1", json!(null)),
    ("/questions/1/content_version", "test-rc-1", json!(2)),
    ("/questions/1/provenance/authoring_batch", "test-rc-1", json!("changed")),
    ("/questions/1/quality/reviewer_notes", "test-rc-1", json!("changed")),
    ("/passages/0/title", "test-passage-1", json!("changed")),
    ("/passages/0/texts/1/text", "test-passage-1", json!("changed")),
    ("/passages/0/content_version", "test-passage-1", json!(2)),
    ("/passages/0/provenance/source_material_used", "test-passage-1", json!("changed")),
    ("/categories/0/name", "test-category", json!("changed")),
    ("/categories/0/sort_order", "test-category", json!(99)),
  ];
  for (path, id, new) in edits {
    let bytes = second_package(|value| *value.pointer_mut(path).unwrap() = new.clone());
    let text = reasons(import_now(&mut conn, &bytes));
    assert!(text.contains(id) && text.contains("different content"), "{path}: {text}");
  }
  assert_eq!(dump(&conn, &CONTENT_TABLES), before);
}

#[test]
fn storing_never_replaces_even_without_the_plan_check() {
  let dir = TempDir::new();
  let mut conn = open(&dir);
  import_now(&mut conn, VALID.as_bytes()).unwrap();
  let package = package::read(VALID.as_bytes()).unwrap();
  assert!(store::insert_package(&conn, &package, "", "now").is_err());
  assert!(store::insert_category(&conn, &package.categories[0]).is_err());
  assert!(store::insert_passage(&conn, &package, &package.passages[0], "now").is_err());
  assert!(store::insert_question(&conn, &package, &package.questions[0], "now").is_err());
}

#[test]
fn refuses_a_new_question_for_a_retired_passage() {
  let dir = TempDir::new();
  let mut conn = database_in_use(&dir);
  conn.execute("UPDATE passages SET status = 'retired'", []).unwrap();
  let bytes = second_package(|value| value["questions"][1]["id"] = json!("test-rc-2"));
  assert!(reasons(import_now(&mut conn, &bytes)).contains("passage that is not available"));
}

#[test]
fn refuses_missing_or_mismatched_references() {
  let dir = TempDir::new();
  let mut conn = open(&dir);
  for (path, new, expected) in [
    ("/questions/1/passage_id", "missing", "passage that is not available"),
    ("/questions/0/primary_category", "missing", "category that is not available"),
    ("/questions/0/primary_category", "rc-detail", "category that is not available"),
  ] {
    let bytes = edited(|value| *value.pointer_mut(path).unwrap() = json!(new));
    assert!(reasons(import_now(&mut conn, &bytes)).contains(expected), "{path}");
  }
}

#[test]
fn refuses_files_that_break_the_format() {
  let dir = TempDir::new();
  let mut conn = open(&dir);
  let before = dump(&conn, &CONTENT_TABLES);
  let edits: Vec<(&str, Value)> = vec![
    ("/format", json!("other")),
    ("/schema_version", json!(2)),
    ("/questions", json!([])),
    ("/questions/0/quality/draft_status", json!("draft")),
    ("/questions/0/quality/independent_solve", json!("failed")),
    ("/questions/0/quality/ambiguity_review", json!("pending")),
    ("/questions/0/quality/human_review", json!("failed")),
    ("/passages/0/status", json!("reviewed")),
    ("/questions/0/correct_choice", json!("F")),
    ("/questions/0/choices/1/label", json!("A")),
    ("/questions/0/choices", json!([])),
    ("/passages/0/passage_type", json!("single")),
    ("/questions/0/section", json!("logic_games")),
    ("/questions/0/provenance/origin", json!("copied")),
    ("/questions/1/id", json!("test-lr-1")),
  ];
  for (path, new) in edits {
    let bytes = edited(|value| *value.pointer_mut(path).unwrap() = new.clone());
    assert!(matches!(preview(&mut conn, &bytes), Err(ImportError::Refused(_))), "{path}");
  }
  let extra = edited(|value| value["questions"][0]["extra"] = json!(1));
  assert!(matches!(preview(&mut conn, &extra), Err(ImportError::Refused(_))));
  assert_eq!(dump(&conn, &CONTENT_TABLES), before);
}

#[test]
fn refuses_unreadable_files() {
  let dir = TempDir::new();
  let mut conn = open(&dir);
  let repeated = VALID.replacen("\"correct_choice\": \"C\"", "\"correct_choice\": \"A\", \"correct_choice\": \"C\"", 1);
  assert_ne!(repeated, VALID);
  let deep = "[".repeat(100_000);
  for bytes in [
    b"".to_vec(),
    b"{".to_vec(),
    b"{\"format\":\"\xFF\"}".to_vec(),
    deep.into_bytes(),
    repeated.into_bytes(),
    // Valid apart from its size.
    [VALID.as_bytes(), &vec![b' '; 20 * 1024 * 1024]].concat(),
  ] {
    assert!(matches!(preview(&mut conn, &bytes), Err(ImportError::Refused(_))));
  }
}

#[test]
fn error_messages_do_not_repeat_file_content() {
  let dir = TempDir::new();
  let mut conn = open(&dir);
  let bytes = edited(|value| value["questions"][0]["correct_choice"] = json!("<evil>"));
  assert!(!preview(&mut conn, &bytes).unwrap_err().to_string().contains("evil"));
}

// ---------------------------------------------------------------- Changes after preview

#[test]
fn refuses_a_file_that_changed_after_the_preview() {
  let dir = TempDir::new();
  let mut conn = open(&dir);
  let before = dump(&conn, &CONTENT_TABLES);
  let plan = preview(&mut conn, VALID.as_bytes()).unwrap();
  let changed = edited(|value| value["questions"][0]["prompt"] = json!("swapped"));
  let spaced = format!("{VALID} ");
  for bytes in [changed.as_slice(), spaced.as_bytes(), b"damaged"] {
    assert!(matches!(import(&mut conn, bytes, &plan), Err(ImportError::Changed)));
  }
  assert_eq!(dump(&conn, &CONTENT_TABLES), before);
  assert_eq!(statuses(&conn), ["rejected_validation"; 3]);
}

#[test]
fn refuses_if_the_question_bank_changed_after_the_preview() {
  let dir = TempDir::new();
  let mut conn = database_in_use(&dir);
  let bytes = second_package(|_| ());
  let plan = preview(&mut conn, &bytes).unwrap();
  let other = second_package(|value| value["package_id"] = json!("third-package"));
  import_now(&mut conn, &other).unwrap();
  assert!(matches!(import(&mut conn, &bytes, &plan), Err(ImportError::Changed)));
}

#[test]
fn a_blocked_preview_cannot_be_confirmed() {
  let dir = TempDir::new();
  let mut conn = database_in_use(&dir);
  let plan = preview(&mut conn, VALID.as_bytes()).unwrap();
  assert!(!plan.problems.is_empty());
  reasons(import(&mut conn, VALID.as_bytes(), &plan));
}

// ---------------------------------------------------------------- Rollback and user data

#[test]
fn a_write_failure_at_any_point_undoes_everything() {
  // Each trigger makes one kind of write fail, some partway through.
  let failures = [
    "BEFORE INSERT ON main.content_packages BEGIN SELECT RAISE(ABORT, 'test'); END",
    "BEFORE INSERT ON main.question_categories BEGIN SELECT RAISE(ABORT, 'test'); END",
    "BEFORE INSERT ON main.passages BEGIN SELECT RAISE(ABORT, 'test'); END",
    "BEFORE INSERT ON main.passage_texts WHEN NEW.label = 'B' BEGIN SELECT RAISE(ABORT, 'test'); END",
    "BEFORE INSERT ON main.questions WHEN NEW.id = 'new-rc' BEGIN SELECT RAISE(ABORT, 'test'); END",
    "BEFORE INSERT ON main.answer_choices WHEN NEW.id = 'new-rc:E' BEGIN SELECT RAISE(ABORT, 'test'); END",
    "BEFORE INSERT ON main.question_tags WHEN NEW.question_id = 'new-rc' BEGIN SELECT RAISE(ABORT, 'test'); END",
    "BEFORE INSERT ON main.content_import_history WHEN NEW.status = 'succeeded' BEGIN SELECT RAISE(ABORT, 'test'); END",
    // Breaks a rule that is only checked at the final commit.
    "AFTER INSERT ON main.content_import_history WHEN NEW.status = 'succeeded'
       BEGIN UPDATE questions SET correct_choice_id = 'missing' WHERE id = 'new-rc'; END",
  ];
  let bytes = edited(|value| {
    value["package_id"] = json!("second-package");
    value["categories"][0]["id"] = json!("new-category");
    value["passages"][0]["id"] = json!("new-passage");
    value["questions"][0]["id"] = json!("new-lr");
    value["questions"][1]["id"] = json!("new-rc");
    value["questions"][1]["passage_id"] = json!("new-passage");
  });
  for failure in failures {
    let dir = TempDir::new();
    let mut conn = database_in_use(&dir);
    let content = dump(&conn, &CONTENT_TABLES);
    let user = dump(&conn, &USER_TABLES);
    let plan = preview(&mut conn, &bytes).unwrap();
    assert!(plan.problems.is_empty());

    conn.execute_batch(&format!("CREATE TEMP TRIGGER fail {failure};")).unwrap();
    let result = import(&mut conn, &bytes, &plan);
    assert!(matches!(result, Err(ImportError::Failed(_))), "{failure}: {result:?}");
    assert!(conn.is_autocommit(), "{failure}");
    assert_eq!(dump(&conn, &CONTENT_TABLES), content, "{failure}");
    assert_eq!(dump(&conn, &USER_TABLES), user, "{failure}");
    assert_eq!(statuses(&conn), ["failed_rollback", "succeeded"], "{failure}");

    // The same file imports normally once the cause is gone.
    conn.execute_batch("DROP TRIGGER fail;").unwrap();
    import(&mut conn, &bytes, &plan).unwrap();
  }
}

#[test]
fn imports_never_change_user_activity_or_existing_content() {
  let dir = TempDir::new();
  let mut conn = database_in_use(&dir);
  let user = dump(&conn, &USER_TABLES);
  let content = dump(&conn, &CONTENT_TABLES);
  import_now(&mut conn, &second_package(|_| ())).unwrap();
  let _ = import_now(&mut conn, VALID.as_bytes());
  assert_eq!(user.len(), 6);
  assert_eq!(dump(&conn, &USER_TABLES), user);
  let after = dump(&conn, &CONTENT_TABLES);
  assert!(content.iter().all(|row| after.contains(row)));
}

#[test]
fn text_that_looks_like_sql_is_stored_as_text() {
  let dir = TempDir::new();
  let mut conn = open(&dir);
  let text = "'); DROP TABLE attempts; --";
  let bytes = edited(|value| value["questions"][0]["prompt"] = json!(text));
  import_now(&mut conn, &bytes).unwrap();
  assert_eq!(store::load_question(&conn, "test-lr-1").unwrap().unwrap().prompt, text);
  assert!(dump(&conn, &USER_TABLES).is_empty());
}

#[test]
fn records_rejected_files_with_a_limited_summary() {
  let dir = TempDir::new();
  let conn = open(&dir);
  history::record_rejection(&conn, &"é".repeat(5000)).unwrap();
  let entry = &list_history(&conn).unwrap()[0];
  assert_eq!(entry.status, "rejected_validation");
  assert_eq!(entry.summary.chars().count(), 1000);
}

#[test]
fn imports_a_package_at_the_question_limit() {
  let dir = TempDir::new();
  let mut conn = open(&dir);
  let bytes = edited(|value| {
    let template = value["questions"][0].clone();
    let questions = value["questions"].as_array_mut().unwrap();
    for number in 0..1998 {
      let mut question = template.clone();
      question["id"] = json!(format!("bulk-{number}"));
      questions.push(question);
    }
  });
  assert_eq!(import_now(&mut conn, &bytes).unwrap().questions.new.len(), 2000);
}

// ---------------------------------------------------------------- Import session

/// A package file on disk and a session that has chosen it.
fn choose(dir: &TempDir, conn: &Connection, bytes: &[u8]) -> (std::path::PathBuf, Session) {
  let path = dir.0.join("package.json");
  std::fs::write(&path, bytes).unwrap();
  let mut session = Session::default();
  session.choose(conn, &path).unwrap();
  (path, session)
}

#[test]
fn a_session_imports_the_previewed_file_once() {
  let dir = TempDir::new();
  let mut conn = open(&dir);
  let (_, mut session) = choose(&dir, &conn, VALID.as_bytes());
  assert_eq!(session.bytes().unwrap(), VALID.as_bytes());
  session.preview(&mut conn).unwrap();
  assert_eq!(session.confirm(&mut conn).unwrap().questions.new.len(), 2);
  reasons(session.confirm(&mut conn));
  assert_eq!(statuses(&conn), ["succeeded"]);
}

#[test]
fn a_session_needs_a_file_and_a_preview() {
  let dir = TempDir::new();
  let mut conn = open(&dir);
  let mut empty = Session::default();
  assert!(empty.bytes().is_err());
  reasons(empty.preview(&mut conn));
  reasons(empty.confirm(&mut conn));
  assert!(empty.reject(&conn, "no").is_err());
  let (_, mut session) = choose(&dir, &conn, VALID.as_bytes());
  assert!(reasons(session.confirm(&mut conn)).contains("Preview"));
  assert!(statuses(&conn).is_empty());
}

#[test]
fn cancelling_imports_and_records_nothing() {
  let dir = TempDir::new();
  let mut conn = open(&dir);
  let (_, mut session) = choose(&dir, &conn, VALID.as_bytes());
  session.preview(&mut conn).unwrap();
  session.cancel();
  reasons(session.confirm(&mut conn));
  assert!(statuses(&conn).is_empty());
}

#[test]
fn a_rejected_file_cannot_be_imported() {
  let dir = TempDir::new();
  let mut conn = open(&dir);
  let (_, mut session) = choose(&dir, &conn, VALID.as_bytes());
  session.preview(&mut conn).unwrap();
  session.reject(&conn, "Not valid.").unwrap();
  reasons(session.confirm(&mut conn));
  let entries = list_history(&conn).unwrap();
  assert_eq!((entries.len(), entries[0].summary.as_str()), (1, "Not valid."));
  assert_eq!(entries[0].display_name, None);
}

#[test]
fn a_blocked_preview_is_recorded_and_ends_the_session() {
  let dir = TempDir::new();
  let mut conn = database_in_use(&dir);
  let (_, mut session) = choose(&dir, &conn, VALID.as_bytes());
  assert!(!session.preview(&mut conn).unwrap().problems.is_empty());
  reasons(session.confirm(&mut conn));
  let entry = &list_history(&conn).unwrap()[0];
  assert_eq!(entry.status, "rejected_validation");
  assert_eq!(entry.display_name.as_deref(), Some("TEST DATA package"));
}

#[test]
fn a_file_the_engine_refuses_is_recorded_without_its_details() {
  let dir = TempDir::new();
  let mut conn = open(&dir);
  let (_, mut session) = choose(&dir, &conn, b"{}");
  reasons(session.preview(&mut conn));
  reasons(session.confirm(&mut conn));
  assert_eq!(statuses(&conn), ["rejected_validation"]);
  assert_eq!(list_history(&conn).unwrap()[0].display_name, None);
}

#[test]
fn confirming_reads_the_file_again() {
  for change in ["replace", "delete"] {
    let dir = TempDir::new();
    let mut conn = open(&dir);
    let before = dump(&conn, &CONTENT_TABLES);
    let (path, mut session) = choose(&dir, &conn, VALID.as_bytes());
    session.preview(&mut conn).unwrap();
    match change {
      "replace" => std::fs::write(&path, second_package(|_| ())).unwrap(),
      _ => std::fs::remove_file(&path).unwrap(),
    }
    assert!(matches!(session.confirm(&mut conn), Err(ImportError::Changed)), "{change}");
    assert_eq!(dump(&conn, &CONTENT_TABLES), before);
  }
}

#[test]
fn a_new_choice_replaces_the_old_one_even_if_it_fails() {
  let dir = TempDir::new();
  let mut conn = open(&dir);
  let (_, mut session) = choose(&dir, &conn, VALID.as_bytes());
  session.preview(&mut conn).unwrap();
  assert!(session.choose(&conn, &dir.0.join("missing.json")).is_err());
  reasons(session.confirm(&mut conn));
}

#[test]
fn refuses_folders_missing_files_and_large_files() {
  let dir = TempDir::new();
  let conn = open(&dir);
  let large = dir.0.join("large.json");
  std::fs::File::create(&large).unwrap().set_len(20 * 1024 * 1024 + 1).unwrap();
  let mut session = Session::default();
  for (path, expected) in [
    (dir.0.clone(), "not a folder"),
    (dir.0.join("missing.json"), "could not be read"),
    (large, "20 MB"),
  ] {
    let error = session.choose(&conn, &path).unwrap_err().to_string();
    assert!(error.contains(expected), "{error}");
  }
  assert_eq!(statuses(&conn), ["rejected_validation"; 3]);
}

#[test]
fn the_original_error_survives_when_history_cannot_be_recorded() {
  let dir = TempDir::new();
  let mut conn = open(&dir);
  let before = dump(&conn, &CONTENT_TABLES);
  let plan = preview(&mut conn, VALID.as_bytes()).unwrap();
  conn
    .execute_batch(
      "CREATE TEMP TRIGGER a BEFORE INSERT ON main.questions BEGIN SELECT RAISE(ABORT, 'original'); END;
       CREATE TEMP TRIGGER b BEFORE INSERT ON main.content_import_history
         BEGIN SELECT RAISE(ABORT, 'history'); END;",
    )
    .unwrap();
  let error = import(&mut conn, VALID.as_bytes(), &plan).unwrap_err().to_string();
  assert!(error.contains("original") && !error.contains("history"), "{error}");
  assert_eq!(dump(&conn, &CONTENT_TABLES), before);
  assert!(statuses(&conn).is_empty());
}
