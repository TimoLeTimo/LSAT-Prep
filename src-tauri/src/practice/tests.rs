use std::time::{Duration, Instant};

use serde_json::{Value, json};

use super::*;
use crate::{
  db::{self, test_support::TempDir},
  import,
};

/// TEST DATA ONLY: four LR questions with key C, and one RC question with key C.
fn database(dir: &TempDir) -> Connection {
  let mut package: Value =
    serde_json::from_str(include_str!("../../../tests/fixtures/valid-package.json")).unwrap();
  let template = package["questions"][0].clone();
  for (number, category, difficulty) in [(2, "lr-strengthen", 3), (3, "lr-flaw", 2), (4, "lr-flaw", 4)] {
    let mut question = template.clone();
    question["id"] = json!(format!("test-lr-{number}"));
    question["primary_category"] = json!(category);
    question["difficulty"] = json!(difficulty);
    package["questions"].as_array_mut().unwrap().push(question);
  }
  let path = dir.0.join("package.json");
  std::fs::write(&path, package.to_string()).unwrap();
  let mut conn = db::open(&dir.0).unwrap();
  let mut session = import::Session::default();
  session.choose(&conn, &path).unwrap();
  session.preview(&mut conn).unwrap();
  session.confirm(&mut conn).unwrap();
  conn
}

fn config(explanations: Explanations, question_count: usize) -> Config {
  Config {
    section: Some(Section::LogicalReasoning),
    category_ids: vec![],
    difficulties: vec![],
    question_count,
    explanations,
    passage_count: None,
    time_limit_seconds: None,
    custom: None,
  }
}

fn ids(numbers: &[u8]) -> Vec<String> {
  numbers.iter().map(|number| format!("test-lr-{number}")).collect()
}

/// A session with questions 3, 1, 2, in that order.
fn start(conn: &mut Connection, explanations: Explanations) -> Session {
  create(conn, &config(explanations, 3), &ids(&[3, 1, 2])).unwrap()
}

fn refusal<T: fmt::Debug>(result: Result<T>) -> &'static str {
  match result {
    Err(PracticeError::Refused(reason)) => reason,
    other => panic!("expected a refusal, got {other:?}"),
  }
}

fn attempts(conn: &Connection) -> Vec<(String, bool, i64)> {
  conn
    .prepare("SELECT selected_choice_id, is_correct, time_spent_seconds FROM attempts ORDER BY rowid")
    .unwrap()
    .query_map([], |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)))
    .unwrap()
    .collect::<rusqlite::Result<_>>()
    .unwrap()
}

// ---------------------------------------------------------------- Starting

#[test]
fn starts_with_the_chosen_questions_in_order_and_hides_answers() {
  let dir = TempDir::new();
  let mut conn = database(&dir);
  let session = start(&mut conn, Explanations::AfterEach);
  let found: Vec<_> = session.questions.iter().map(|question| question.question_id.as_str()).collect();
  assert_eq!(found, ["test-lr-3", "test-lr-1", "test-lr-2"]);
  assert_eq!((session.status, session.current_position), (Status::InProgress, 0));
  let sent = serde_json::to_string(&session).unwrap();
  for hidden in ["correct_choice", "Test C.", "quality", "provenance"] {
    assert!(!sent.contains(hidden), "{hidden}");
  }
  assert!(attempts(&conn).is_empty());
}

#[test]
fn refuses_questions_that_do_not_fit() {
  let dir = TempDir::new();
  let mut conn = database(&dir);
  let base = config(Explanations::AtEnd, 1);
  let cases: Vec<(Config, Vec<String>, &str)> = vec![
    (config(Explanations::AtEnd, 0), vec![], "between 1 and 500"),
    (config(Explanations::AtEnd, 501), vec!["x".into(); 501], "between 1 and 500"),
    (config(Explanations::AtEnd, 2), ids(&[1]), "does not match"),
    (config(Explanations::AtEnd, 2), ids(&[1, 1]), "twice"),
    (base.clone(), ids(&[9]), "no longer available"),
    (base.clone(), vec!["test-rc-1".into()], "does not fit"),
    (Config { category_ids: vec!["lr-flaw".into()], ..base.clone() }, ids(&[1]), "does not fit"),
    (Config { time_limit_seconds: Some(59), ..base.clone() }, ids(&[1]), "time limit"),
    (Config { time_limit_seconds: Some(21601), ..base.clone() }, ids(&[1]), "time limit"),
    (Config { difficulties: vec![4], ..base.clone() }, ids(&[1]), "does not fit"),
  ];
  for (config, questions, expected) in cases {
    assert!(refusal(create(&mut conn, &config, &questions)).contains(expected), "{expected}");
  }
  assert_eq!(unfinished(&conn, Some(Section::LogicalReasoning)).unwrap(), None);
}

#[test]
fn refuses_content_that_cannot_be_practiced() {
  for change in [
    "UPDATE questions SET status = 'retired' WHERE id = 'test-lr-2'",
    "UPDATE question_categories SET active = 0 WHERE id = 'lr-strengthen'",
  ] {
    let dir = TempDir::new();
    let mut conn = database(&dir);
    conn.execute(change, []).unwrap();
    let result = create(&mut conn, &config(Explanations::AtEnd, 2), &ids(&[3, 2]));
    assert!(refusal(result).contains("no longer available"));
    // The first question was fine, but nothing may be left behind.
    let rows: i64 = conn
      .query_row("SELECT (SELECT count(*) FROM practice_sessions) + (SELECT count(*) FROM session_questions)", [], |row| row.get(0))
      .unwrap();
    assert_eq!(rows, 0);
  }
}

#[test]
fn refuses_a_question_whose_passage_is_retired() {
  let dir = TempDir::new();
  let mut conn = database(&dir);
  conn.execute("UPDATE passages SET status = 'retired'", []).unwrap();
  let rc = Config {
    section: Some(Section::ReadingComprehension),
    passage_count: Some(1),
    ..config(Explanations::AtEnd, 1)
  };
  let result = create(&mut conn, &rc, &["test-rc-1".into()]);
  assert!(refusal(result).contains("no longer available"));
}

#[test]
fn allows_one_unfinished_session_for_each_section() {
  let dir = TempDir::new();
  let mut conn = database(&dir);
  let first = start(&mut conn, Explanations::AtEnd);
  let again = create(&mut conn, &config(Explanations::AtEnd, 1), &ids(&[4]));
  assert!(refusal(again).contains("current session"));
  let rc = Config {
    section: Some(Section::ReadingComprehension),
    passage_count: Some(1),
    ..config(Explanations::AtEnd, 1)
  };
  let rc = create(&mut conn, &rc, &["test-rc-1".into()]).unwrap();
  assert!(rc.questions[0].passage.is_some());
  abandon(&mut conn, &first.id).unwrap();
  create(&mut conn, &config(Explanations::AtEnd, 1), &ids(&[4])).unwrap();
}

// ---------------------------------------------------------------- Saving and recovery

#[test]
fn everything_survives_without_a_clean_close() {
  let dir = TempDir::new();
  let mut conn = database(&dir);
  let session = start(&mut conn, Explanations::AfterEach);
  let question = |index: usize| session.questions[index].id.as_str();
  select(&mut conn, question(0), Some(Label::C)).unwrap();
  add_time(&mut conn, question(0), 20).unwrap();
  add_time(&mut conn, question(0), 15).unwrap();
  submit(&mut conn, question(0)).unwrap();
  select(&mut conn, question(1), Some(Label::B)).unwrap();
  set_flag(&mut conn, question(2), true).unwrap();
  set_position(&mut conn, &session.id, 2).unwrap();
  let expected = load(&conn, &session.id).unwrap();

  // Copy the live files, as they would be on disk after a crash.
  let after = TempDir::new();
  for name in ["lsat-prep.db", "lsat-prep.db-wal"] {
    std::fs::copy(dir.0.join(name), after.0.join(name)).unwrap();
  }
  let recovered = unfinished(&db::open(&after.0).unwrap(), Some(Section::LogicalReasoning)).unwrap().unwrap();
  assert_eq!(recovered, expected);
  assert_eq!(recovered.current_position, 2);
  assert_eq!(recovered.questions[0].time_spent_seconds, 35);
  assert!(recovered.questions[0].is_submitted);
  assert_eq!(recovered.questions[1].selected, Some(Label::B));
  assert!(!recovered.questions[1].is_submitted && recovered.questions[2].is_flagged);
}

#[test]
fn resuming_shows_the_saved_copy_even_if_content_changes() {
  let dir = TempDir::new();
  let mut conn = database(&dir);
  let before = start(&mut conn, Explanations::AtEnd);
  conn
    .execute_batch(
      "UPDATE questions SET status = 'retired', prompt = 'changed', correct_choice_id = id || ':A'
         WHERE section = 'logical_reasoning';
       UPDATE answer_choices SET choice_text = 'changed', explanation = 'changed';
       UPDATE question_categories SET name = 'changed';",
    )
    .unwrap();
  assert_eq!(unfinished(&conn, Some(Section::LogicalReasoning)).unwrap().unwrap(), before);
  // Marked against what was shown (key C), not the changed key.
  select(&mut conn, &before.questions[0].id, Some(Label::C)).unwrap();
  let done = finish(&mut conn, &before.id).unwrap();
  let outcome = done.questions[0].outcome.as_ref().unwrap();
  assert_eq!((outcome.is_correct, outcome.correct_choice), (Some(true), Label::C));
  assert_eq!(outcome.explanations.c, "Test C.");
}

// ---------------------------------------------------------------- Answers

#[test]
fn a_selection_can_change_or_be_cleared_before_submitting() {
  let dir = TempDir::new();
  let mut conn = database(&dir);
  let session = start(&mut conn, Explanations::AtEnd);
  let id = &session.questions[0].id;
  for choice in [Some(Label::A), Some(Label::E), None, Some(Label::C)] {
    select(&mut conn, id, choice).unwrap();
    assert_eq!(load(&conn, &session.id).unwrap().questions[0].selected, choice);
    let answered: bool = conn
      .query_row("SELECT answered_at IS NOT NULL FROM session_questions WHERE id = ?1", [id], |row| row.get(0))
      .unwrap();
    assert_eq!(answered, choice.is_some());
  }
  assert!(attempts(&conn).is_empty());
}

#[test]
fn check_answer_submits_once_and_locks() {
  let dir = TempDir::new();
  let mut conn = database(&dir);
  let session = start(&mut conn, Explanations::AfterEach);
  let id = session.questions[0].id.clone();
  assert!(refusal(submit(&mut conn, &id)).contains("Choose an answer"));
  select(&mut conn, &id, Some(Label::A)).unwrap();
  add_time(&mut conn, &id, 12).unwrap();
  let after = submit(&mut conn, &id).unwrap();
  let outcome = after.questions[0].outcome.as_ref().unwrap();
  assert_eq!((outcome.is_correct, outcome.correct_choice), (Some(false), Label::C));
  assert!(after.questions[1].outcome.is_none(), "other answers stay hidden");

  assert_eq!(submit(&mut conn, &id).unwrap(), after, "repeating changes nothing");
  assert!(refusal(select(&mut conn, &id, Some(Label::C))).contains("already submitted"));
  assert!(refusal(select(&mut conn, &id, None)).contains("already submitted"));
  assert!(refusal(add_time(&mut conn, &id, 1)).contains("already submitted"));
  assert_eq!(attempts(&conn), [("test-lr-3:A".into(), false, 12)]);
}

#[test]
fn answers_stay_open_when_explanations_come_at_the_end() {
  let dir = TempDir::new();
  let mut conn = database(&dir);
  let session = start(&mut conn, Explanations::AtEnd);
  let id = &session.questions[0].id;
  select(&mut conn, id, Some(Label::A)).unwrap();
  assert!(refusal(submit(&mut conn, id)).contains("when you finish"));
  assert!(attempts(&conn).is_empty());
  select(&mut conn, id, Some(Label::C)).unwrap();
}

// ---------------------------------------------------------------- Ending

#[test]
fn finishing_submits_selected_answers_only() {
  let dir = TempDir::new();
  let mut conn = database(&dir);
  let session = start(&mut conn, Explanations::AtEnd);
  select(&mut conn, &session.questions[0].id, Some(Label::C)).unwrap();
  select(&mut conn, &session.questions[1].id, Some(Label::D)).unwrap();
  let done = finish(&mut conn, &session.id).unwrap();
  assert_eq!(done.status, Status::Completed);
  assert!(done.completed_at.is_some());
  let results: Vec<_> =
    done.questions.iter().map(|question| question.outcome.as_ref().unwrap().is_correct).collect();
  assert_eq!(results, [Some(true), Some(false), None]);
  assert_eq!(attempts(&conn).len(), 2);
  assert_eq!(unfinished(&conn, Some(Section::LogicalReasoning)).unwrap(), None);
}

#[test]
fn finishing_keeps_answers_that_were_already_checked() {
  let dir = TempDir::new();
  let mut conn = database(&dir);
  let session = start(&mut conn, Explanations::AfterEach);
  for (question, choice) in session.questions.iter().zip([Label::C, Label::B]) {
    select(&mut conn, &question.id, Some(choice)).unwrap();
  }
  submit(&mut conn, &session.questions[0].id).unwrap();
  finish(&mut conn, &session.id).unwrap();
  let found: Vec<_> = attempts(&conn).into_iter().map(|(choice, ..)| choice).collect();
  assert_eq!(found, ["test-lr-3:C", "test-lr-1:B"]);
}

#[test]
fn ending_early_submits_nothing_more_and_keeps_checked_answers() {
  let dir = TempDir::new();
  let mut conn = database(&dir);
  let session = start(&mut conn, Explanations::AfterEach);
  for question in &session.questions[..2] {
    select(&mut conn, &question.id, Some(Label::C)).unwrap();
  }
  submit(&mut conn, &session.questions[0].id).unwrap();
  abandon(&mut conn, &session.id).unwrap();
  assert_eq!(attempts(&conn).len(), 1);
  let ended = load(&conn, &session.id).unwrap();
  assert_eq!(ended.status, Status::Abandoned);
  assert!(ended.questions[0].outcome.is_some() && ended.questions[1].outcome.is_none());
}

#[test]
fn an_ended_session_cannot_change() {
  for finished in [true, false] {
    let dir = TempDir::new();
    let mut conn = database(&dir);
    let session = start(&mut conn, Explanations::AfterEach);
    let id = &session.questions[0].id;
    select(&mut conn, id, Some(Label::B)).unwrap();
    if finished {
      finish(&mut conn, &session.id).unwrap();
    } else {
      abandon(&mut conn, &session.id).unwrap();
    }
    let before = load(&conn, &session.id).unwrap();
    let count = attempts(&conn).len();
    for reason in [
      refusal(select(&mut conn, id, Some(Label::C))),
      refusal(set_flag(&mut conn, id, true)),
      refusal(add_time(&mut conn, id, 1)),
      refusal(set_position(&mut conn, &session.id, 1)),
      refusal(submit(&mut conn, id)),
      refusal(finish(&mut conn, &session.id)),
      refusal(abandon(&mut conn, &session.id)),
    ] {
      assert_eq!(reason, "This practice session has ended.");
    }
    assert_eq!(load(&conn, &session.id).unwrap(), before);
    assert_eq!(attempts(&conn).len(), count);
  }
}

// ---------------------------------------------------------------- Bad input and failures

#[test]
fn refuses_unknown_ids_and_bad_values() {
  let dir = TempDir::new();
  let mut conn = database(&dir);
  let session = start(&mut conn, Explanations::AfterEach);
  assert!(refusal(select(&mut conn, "x", None)).contains("not found"));
  assert!(refusal(finish(&mut conn, "x")).contains("not found"));
  assert!(refusal(load(&conn, "x")).contains("not found"));
  for position in [-1, 3] {
    assert!(refusal(set_position(&mut conn, &session.id, position)).contains("not in the session"));
  }
  for seconds in [-1, 601] {
    assert!(refusal(add_time(&mut conn, &session.questions[0].id, seconds)).contains("not valid"));
  }
}

#[test]
fn a_failed_finish_changes_nothing_and_can_be_repeated() {
  let dir = TempDir::new();
  let mut conn = database(&dir);
  let session = start(&mut conn, Explanations::AtEnd);
  for question in &session.questions {
    select(&mut conn, &question.id, Some(Label::C)).unwrap();
  }
  let before = load(&conn, &session.id).unwrap();
  // The last answer fails after the others were written.
  conn
    .execute_batch(
      "CREATE TEMP TRIGGER fail BEFORE INSERT ON main.attempts WHEN NEW.question_id = 'test-lr-2'
       BEGIN SELECT RAISE(ABORT, 'test'); END;",
    )
    .unwrap();
  assert!(matches!(finish(&mut conn, &session.id), Err(PracticeError::Failed(_))));
  assert_eq!(load(&conn, &session.id).unwrap(), before);
  assert!(attempts(&conn).is_empty());
  conn.execute_batch("DROP TRIGGER fail;").unwrap();
  finish(&mut conn, &session.id).unwrap();
  assert_eq!(attempts(&conn).len(), 3);
}

#[test]
fn the_same_question_can_be_practiced_again_later() {
  let dir = TempDir::new();
  let mut conn = database(&dir);
  for choice in [Label::A, Label::C] {
    let session = create(&mut conn, &config(Explanations::AtEnd, 1), &ids(&[1])).unwrap();
    select(&mut conn, &session.questions[0].id, Some(choice)).unwrap();
    finish(&mut conn, &session.id).unwrap();
  }
  let results: Vec<_> = attempts(&conn).into_iter().map(|(_, correct, _)| correct).collect();
  assert_eq!(results, [false, true]);
}

// ---------------------------------------------------------------- Bookmarks

fn bookmarks(conn: &Connection) -> Vec<(String, String)> {
  conn
    .prepare("SELECT id, question_id FROM bookmarks ORDER BY question_id")
    .unwrap()
    .query_map([], |row| Ok((row.get(0)?, row.get(1)?)))
    .unwrap()
    .collect::<rusqlite::Result<_>>()
    .unwrap()
}

#[test]
fn bookmarks_outlast_the_session_and_appear_in_later_ones() {
  let dir = TempDir::new();
  let mut conn = database(&dir);
  let session = start(&mut conn, Explanations::AtEnd);
  set_bookmark(&mut conn, "test-lr-1", true).unwrap();
  let shown = |conn: &Connection, id: &str| -> Vec<bool> {
    load(conn, id).unwrap().questions.iter().map(|question| question.is_bookmarked).collect()
  };
  assert_eq!(shown(&conn, &session.id), [false, true, false]);
  finish(&mut conn, &session.id).unwrap();
  let later = create(&mut conn, &config(Explanations::AtEnd, 2), &ids(&[1, 4])).unwrap();
  assert_eq!(shown(&conn, &later.id), [true, false]);
  // Reviewing a finished session can still change them.
  set_bookmark(&mut conn, "test-lr-3", true).unwrap();
  set_bookmark(&mut conn, "test-lr-1", false).unwrap();
  assert_eq!(shown(&conn, &session.id), [true, false, false]);
}

#[test]
fn repeating_a_bookmark_changes_nothing() {
  let dir = TempDir::new();
  let mut conn = database(&dir);
  set_bookmark(&mut conn, "test-lr-1", true).unwrap();
  conn.execute("UPDATE bookmarks SET note = 'mine'", []).unwrap();
  let before = bookmarks(&conn);
  set_bookmark(&mut conn, "test-lr-1", true).unwrap();
  assert_eq!(bookmarks(&conn), before);
  let note: String = conn.query_row("SELECT note FROM bookmarks", [], |row| row.get(0)).unwrap();
  assert_eq!(note, "mine");
  for _ in 0..2 {
    set_bookmark(&mut conn, "test-lr-1", false).unwrap();
  }
  assert!(bookmarks(&conn).is_empty());
}

#[test]
fn removing_a_bookmark_leaves_others_and_history_alone() {
  let dir = TempDir::new();
  let mut conn = database(&dir);
  let session = start(&mut conn, Explanations::AtEnd);
  select(&mut conn, &session.questions[0].id, Some(Label::C)).unwrap();
  finish(&mut conn, &session.id).unwrap();
  for id in ["test-lr-1", "test-lr-3"] {
    set_bookmark(&mut conn, id, true).unwrap();
  }
  set_bookmark(&mut conn, "test-lr-3", false).unwrap();
  assert_eq!(bookmarks(&conn).len(), 1);
  assert_eq!(attempts(&conn).len(), 1);
}

#[test]
fn cannot_bookmark_an_unknown_question_but_can_bookmark_a_retired_one() {
  let dir = TempDir::new();
  let mut conn = database(&dir);
  assert!(refusal(set_bookmark(&mut conn, "missing", true)).contains("not found"));
  conn.execute("UPDATE questions SET status = 'retired'", []).unwrap();
  set_bookmark(&mut conn, "test-lr-1", true).unwrap();
}

// ---------------------------------------------------------------- Clock

/// A 60-second session with question 1 answered, and a moment to count from.
fn timed(dir: &TempDir) -> (Connection, Session, Instant) {
  let mut conn = database(dir);
  let config = Config { time_limit_seconds: Some(60), ..config(Explanations::AtEnd, 2) };
  let session = create(&mut conn, &config, &ids(&[1, 2])).unwrap();
  select(&mut conn, &session.questions[0].id, Some(Label::C)).unwrap();
  (conn, session, Instant::now())
}

fn after(start: Instant, seconds: f64) -> Instant {
  start + Duration::from_secs_f64(seconds)
}

fn active_ms(conn: &Connection, id: &str) -> i64 {
  load(conn, id).unwrap().active_ms
}

#[test]
fn counts_down_only_while_running() {
  let dir = TempDir::new();
  let (mut conn, session, t) = timed(&dir);
  let id = &session.id;
  let mut clock = Clock::default();
  assert_eq!(clock.start(&mut conn, id, t).unwrap().remaining_ms, Some(60_000));
  assert_eq!(clock.save(&mut conn, id, after(t, 5.0)).unwrap().remaining_ms, Some(55_000));
  assert_eq!(clock.pause(&mut conn, id, after(t, 10.0)).unwrap().remaining_ms, Some(50_000));
  // A long pause costs nothing.
  assert_eq!(clock.save(&mut conn, id, after(t, 900.0)).unwrap().remaining_ms, Some(50_000));
  assert_eq!(clock.start(&mut conn, id, after(t, 1000.0)).unwrap().remaining_ms, Some(50_000));
  assert_eq!(clock.save(&mut conn, id, after(t, 1001.0)).unwrap().remaining_ms, Some(49_000));
}

#[test]
fn frequent_saves_do_not_lose_fractions() {
  let dir = TempDir::new();
  let (mut conn, session, t) = timed(&dir);
  let mut clock = Clock::default();
  clock.start(&mut conn, &session.id, t).unwrap();
  for step in 1..=1000 {
    clock.save(&mut conn, &session.id, after(t, f64::from(step) * 0.0105)).unwrap();
  }
  assert_eq!(active_ms(&conn, &session.id), 10_500);
}

#[test]
fn running_out_of_time_submits_saved_answers_and_ends() {
  let dir = TempDir::new();
  let (mut conn, session, t) = timed(&dir);
  let mut clock = Clock::default();
  clock.start(&mut conn, &session.id, t).unwrap();
  assert_eq!(clock.save(&mut conn, &session.id, after(t, 59.999)).unwrap().ended, None);
  let reading = clock.save(&mut conn, &session.id, after(t, 75.0)).unwrap();
  let ended = reading.ended.unwrap();
  assert_eq!((reading.remaining_ms, ended.active_ms), (Some(0), 60_000));
  assert_eq!(ended.status, Status::Completed);
  let results: Vec<_> =
    ended.questions.iter().map(|question| question.outcome.as_ref().unwrap().is_correct).collect();
  assert_eq!(results, [Some(true), None]);
  assert_eq!(attempts(&conn).len(), 1);
  // Asking again gives the same result.
  assert_eq!(clock.save(&mut conn, &session.id, after(t, 80.0)).unwrap().ended, Some(ended));
  assert_eq!(attempts(&conn).len(), 1);
}

#[test]
fn late_answers_are_refused() {
  let dir = TempDir::new();
  let (mut conn, session, t) = timed(&dir);
  let mut clock = Clock::default();
  clock.start(&mut conn, &session.id, t).unwrap();
  clock.require_time(&mut conn, &session.id, after(t, 59.0)).unwrap();
  let late = refusal(clock.require_time(&mut conn, &session.id, after(t, 60.0)));
  assert!(late.contains("Time is up"));
  assert_eq!(load(&conn, &session.id).unwrap().status, Status::Completed);
  assert!(refusal(clock.require_time(&mut conn, &session.id, after(t, 61.0))).contains("has ended"));
}

#[test]
fn a_paused_timed_session_cannot_be_answered() {
  let dir = TempDir::new();
  let (mut conn, session, t) = timed(&dir);
  let mut clock = Clock::default();
  assert!(refusal(clock.require_time(&mut conn, &session.id, t)).contains("paused"));
  clock.start(&mut conn, &session.id, t).unwrap();
  clock.require_time(&mut conn, &session.id, t).unwrap();
  clock.pause(&mut conn, &session.id, t).unwrap();
  assert!(refusal(clock.require_time(&mut conn, &session.id, t)).contains("paused"));
}

#[test]
fn an_abrupt_quit_loses_only_time_since_the_last_save() {
  let dir = TempDir::new();
  let (mut conn, session, t) = timed(&dir);
  let mut clock = Clock::default();
  clock.start(&mut conn, &session.id, t).unwrap();
  clock.save(&mut conn, &session.id, after(t, 5.0)).unwrap();
  drop(conn);
  let mut conn = db::open(&dir.0).unwrap();
  let resumed = Clock::default().start(&mut conn, &session.id, after(t, 500.0)).unwrap();
  assert_eq!(resumed.remaining_ms, Some(55_000));
}

#[test]
fn starting_again_without_pausing_drops_unsaved_time() {
  let dir = TempDir::new();
  let (mut conn, session, t) = timed(&dir);
  let mut clock = Clock::default();
  clock.start(&mut conn, &session.id, t).unwrap();
  clock.save(&mut conn, &session.id, after(t, 5.0)).unwrap();
  let again = clock.start(&mut conn, &session.id, after(t, 30.0)).unwrap();
  assert_eq!(again.remaining_ms, Some(55_000));
}

#[test]
fn closing_the_app_saves_the_clock() {
  let dir = TempDir::new();
  let (mut conn, session, t) = timed(&dir);
  let mut clock = Clock::default();
  clock.pause_any(&mut conn, t).unwrap();
  clock.start(&mut conn, &session.id, t).unwrap();
  clock.pause_any(&mut conn, after(t, 7.0)).unwrap();
  clock.pause_any(&mut conn, after(t, 9.0)).unwrap();
  assert_eq!(active_ms(&conn, &session.id), 7_000);
}

#[test]
fn untimed_sessions_count_time_but_never_end() {
  let dir = TempDir::new();
  let mut conn = database(&dir);
  let session = start(&mut conn, Explanations::AtEnd);
  let t = Instant::now();
  let mut clock = Clock::default();
  clock.require_time(&mut conn, &session.id, t).unwrap();
  clock.start(&mut conn, &session.id, t).unwrap();
  let reading = clock.save(&mut conn, &session.id, after(t, 90_000.0)).unwrap();
  assert_eq!(reading, Reading { remaining_ms: None, ended: None });
  assert_eq!(active_ms(&conn, &session.id), 90_000_000);
}

#[test]
fn a_failed_save_at_the_limit_undoes_everything_and_can_be_repeated() {
  let dir = TempDir::new();
  let (mut conn, session, t) = timed(&dir);
  let mut clock = Clock::default();
  clock.start(&mut conn, &session.id, t).unwrap();
  conn
    .execute_batch(
      "CREATE TEMP TRIGGER fail BEFORE INSERT ON main.attempts
       BEGIN SELECT RAISE(ABORT, 'test'); END;",
    )
    .unwrap();
  assert!(matches!(clock.save(&mut conn, &session.id, after(t, 61.0)), Err(PracticeError::Failed(_))));
  let stored = load(&conn, &session.id).unwrap();
  assert_eq!((stored.status, stored.active_ms), (Status::InProgress, 0));
  assert!(clock.require_time(&mut conn, &session.id, after(t, 62.0)).is_err());
  conn.execute_batch("DROP TRIGGER fail;").unwrap();
  assert!(clock.save(&mut conn, &session.id, after(t, 62.0)).unwrap().ended.is_some());
}

#[test]
fn a_failed_save_keeps_the_time_for_the_next_one() {
  let dir = TempDir::new();
  let (mut conn, session, t) = timed(&dir);
  let mut clock = Clock::default();
  clock.start(&mut conn, &session.id, t).unwrap();
  conn
    .execute_batch(
      "CREATE TEMP TRIGGER fail BEFORE UPDATE ON main.practice_sessions
       BEGIN SELECT RAISE(ABORT, 'test'); END;",
    )
    .unwrap();
  assert!(clock.save(&mut conn, &session.id, after(t, 5.0)).is_err());
  conn.execute_batch("DROP TRIGGER fail;").unwrap();
  let reading = clock.save(&mut conn, &session.id, after(t, 8.0)).unwrap();
  assert_eq!(reading.remaining_ms, Some(52_000));
}

#[test]
fn a_clock_for_one_session_does_not_affect_another() {
  let dir = TempDir::new();
  let (mut conn, session, t) = timed(&dir);
  let rc = Config {
    section: Some(Section::ReadingComprehension),
    passage_count: Some(1),
    time_limit_seconds: Some(60),
    ..config(Explanations::AtEnd, 1)
  };
  let other = create(&mut conn, &rc, &["test-rc-1".into()]).unwrap();
  let mut clock = Clock::default();
  clock.start(&mut conn, &session.id, t).unwrap();
  clock.pause(&mut conn, &other.id, after(t, 10.0)).unwrap();
  assert_eq!(active_ms(&conn, &other.id), 0);
  clock.require_time(&mut conn, &session.id, after(t, 10.0)).unwrap();
  assert_eq!(active_ms(&conn, &session.id), 10_000);
}

#[test]
fn sessions_saved_before_timers_existed_are_untimed() {
  let old = r#"{"section":"logical_reasoning","category_ids":[],"difficulties":[],"question_count":1,"explanations":"at_end"}"#;
  let config: Config = serde_json::from_str(old).unwrap();
  assert_eq!((config.time_limit_seconds, config.passage_count, config.custom), (None, None, None));
}

// ---------------------------------------------------------------- Reading Comprehension

/// TEST DATA ONLY: passage p1 with questions z, a, m (in that order) and p2 with b, c.
fn rc_database(dir: &TempDir) -> Connection {
  let mut package: Value =
    serde_json::from_str(include_str!("../../../tests/fixtures/valid-package.json")).unwrap();
  let passage = package["passages"][0].clone();
  let question = package["questions"][1].clone();
  let with_id = |item: &Value, id: &str| {
    let mut item = item.clone();
    item["id"] = json!(id);
    item
  };
  package["passages"] = json!([with_id(&passage, "p1"), with_id(&passage, "p2")]);
  package["questions"] = json!([]);
  for (id, passage_id, category, difficulty) in [
    ("z", "p1", "rc-detail", 1),
    ("a", "p1", "rc-main-idea", 3),
    ("m", "p1", "rc-detail", 2),
    ("b", "p2", "rc-detail", 1),
    ("c", "p2", "rc-structure", 4),
  ] {
    let mut item = with_id(&question, id);
    item["passage_id"] = json!(passage_id);
    item["primary_category"] = json!(category);
    item["difficulty"] = json!(difficulty);
    package["questions"].as_array_mut().unwrap().push(item);
  }
  let path = dir.0.join("rc.json");
  std::fs::write(&path, package.to_string()).unwrap();
  let mut conn = db::open(&dir.0).unwrap();
  let mut session = import::Session::default();
  session.choose(&conn, &path).unwrap();
  session.preview(&mut conn).unwrap();
  session.confirm(&mut conn).unwrap();
  conn
}

fn rc_config(passage_count: usize, question_count: usize) -> Config {
  Config {
    section: Some(Section::ReadingComprehension),
    passage_count: Some(passage_count),
    ..config(Explanations::AtEnd, question_count)
  }
}

fn rc_create(conn: &mut Connection, config: &Config, ids: &str) -> Result<Session> {
  let ids: Vec<_> = ids.chars().map(String::from).collect();
  create(conn, config, &ids)
}

#[test]
fn starts_with_whole_passages_in_the_chosen_order() {
  let dir = TempDir::new();
  let mut conn = rc_database(&dir);
  let session = rc_create(&mut conn, &rc_config(2, 5), "bczam").unwrap();
  let found: String =
    session.questions.iter().map(|question| question.question_id.as_str()).collect();
  assert_eq!(found, "bczam");
  let passages: Vec<_> = serde_json::to_value(&session).unwrap()["questions"]
    .as_array()
    .unwrap()
    .iter()
    .map(|question| question["passage"]["id"].as_str().unwrap().to_owned())
    .collect();
  assert_eq!(passages, ["p2", "p2", "p1", "p1", "p1"]);
}

#[test]
fn refuses_passages_that_are_split_reordered_or_incomplete() {
  let dir = TempDir::new();
  let mut conn = rc_database(&dir);
  for (passages, ids, expected) in [
    (1, "za", "all of its questions"),
    (1, "zma", "all of its questions"),
    (1, "azm", "all of its questions"),
    (2, "zambc", ""),
    (2, "zabmc", "do not match"),
    (2, "zabcm", "do not match"),
    (3, "zabcm", "do not match"),
    (1, "zambc", "do not match"),
    (2, "zam", "do not match"),
  ] {
    let result = rc_create(&mut conn, &rc_config(passages, ids.len()), ids);
    if expected.is_empty() {
      abandon(&mut conn, &result.unwrap().id).unwrap();
    } else {
      assert!(refusal(result).contains(expected), "{passages} {ids}");
    }
  }
}

#[test]
fn filters_apply_to_the_passage_and_keep_its_other_questions() {
  let dir = TempDir::new();
  let mut conn = rc_database(&dir);
  let filtered = |categories: &[&str], difficulties: &[i64]| Config {
    category_ids: categories.iter().map(|id| id.to_string()).collect(),
    difficulties: difficulties.to_vec(),
    ..rc_config(1, 3)
  };
  let session = rc_create(&mut conn, &filtered(&["rc-main-idea"], &[]), "zam").unwrap();
  assert_eq!(session.questions.len(), 3);
  abandon(&mut conn, &session.id).unwrap();
  for config in [
    filtered(&["rc-structure"], &[]),
    filtered(&[], &[4]),
    // Both must match on the same question.
    filtered(&["rc-main-idea"], &[1]),
  ] {
    assert!(refusal(rc_create(&mut conn, &config, "zam")).contains("does not fit"));
  }
}

#[test]
fn questions_that_cannot_be_practiced_are_left_out_of_the_set() {
  let dir = TempDir::new();
  let mut conn = rc_database(&dir);
  conn.execute("UPDATE questions SET status = 'retired' WHERE id = 'a'", []).unwrap();
  assert!(refusal(rc_create(&mut conn, &rc_config(1, 3), "zam")).contains("no longer available"));
  let session = rc_create(&mut conn, &rc_config(1, 2), "zm").unwrap();
  abandon(&mut conn, &session.id).unwrap();
  conn.execute("UPDATE question_categories SET active = 0 WHERE id = 'rc-structure'", []).unwrap();
  rc_create(&mut conn, &rc_config(1, 1), "b").unwrap();
}

#[test]
fn refuses_a_set_that_grew_since_it_was_chosen() {
  let dir = TempDir::new();
  let mut conn = rc_database(&dir);
  // Copies question c as another question of p2.
  conn
    .execute_batch(
      "BEGIN;
       INSERT INTO questions SELECT 'd', section, category_id, difficulty, stimulus, prompt, 'd:C',
         estimated_seconds, passage_id, content_version, status, provenance_json, quality_json,
         package_id, package_version, created_at, updated_at FROM questions WHERE id = 'c';
       INSERT INTO answer_choices SELECT 'd:' || choice_label, 'd', choice_label, choice_text,
         explanation, display_order FROM answer_choices WHERE question_id = 'c';
       COMMIT;",
    )
    .unwrap();
  assert!(refusal(rc_create(&mut conn, &rc_config(1, 2), "bc")).contains("all of its questions"));
  rc_create(&mut conn, &rc_config(1, 3), "bcd").unwrap();
}

#[test]
fn passage_counts_belong_to_reading_comprehension_only() {
  let dir = TempDir::new();
  let mut conn = database(&dir);
  let lr = Config { passage_count: Some(1), ..config(Explanations::AtEnd, 1) };
  assert!(refusal(create(&mut conn, &lr, &ids(&[1]))).contains("does not fit"));
  let rc = Config { passage_count: None, ..rc_config(1, 1) };
  assert!(refusal(create(&mut conn, &rc, &["test-rc-1".into()])).contains("does not fit"));
  let mixed = rc_config(1, 1);
  assert!(refusal(create(&mut conn, &mixed, &ids(&[1]))).contains("does not fit"));
}

#[test]
fn a_passage_survives_recovery_exactly_as_shown() {
  let dir = TempDir::new();
  let mut conn = rc_database(&dir);
  let before = rc_create(&mut conn, &rc_config(1, 3), "zam").unwrap();
  conn
    .execute_batch(
      "UPDATE passage_texts SET text = 'changed'; UPDATE passages SET title = 'changed', status = 'retired';",
    )
    .unwrap();
  drop(conn);
  let conn = db::open(&dir.0).unwrap();
  assert_eq!(unfinished(&conn, Some(Section::ReadingComprehension)).unwrap(), Some(before));
}

// ---------------------------------------------------------------- Custom sessions

/// TEST DATA ONLY: LR q1-q4 (keys C) and RC z, a, m on p1 and b, c on p2 (keys C).
fn mixed_database(dir: &TempDir) -> Connection {
  let mut conn = rc_database(dir);
  let mut package: Value =
    serde_json::from_str(include_str!("../../../tests/fixtures/valid-package.json")).unwrap();
  let template = package["questions"][0].clone();
  package["package_id"] = json!("lr-package");
  package["passages"] = json!([]);
  package["questions"] = json!([]);
  for (number, category) in [(1, "lr-flaw"), (2, "lr-flaw"), (3, "lr-weaken"), (4, "lr-weaken")] {
    let mut question = template.clone();
    question["id"] = json!(format!("q{number}"));
    question["primary_category"] = json!(category);
    question["explanations"] = json!({
      "A": "Why one.", "B": "Why two.", "C": "Why three.", "D": "Why four.", "E": "Why five."
    });
    for (choice, text) in question["choices"].as_array_mut().unwrap().iter_mut().zip(["one", "two", "three", "four", "five"]) {
      choice["text"] = json!(text);
    }
    if number == 4 {
      question["explanations"]["A"] = json!("Unlike B, this is too broad.");
    }
    package["questions"].as_array_mut().unwrap().push(question);
  }
  let path = dir.0.join("lr.json");
  std::fs::write(&path, package.to_string()).unwrap();
  let mut session = import::Session::default();
  session.choose(&conn, &path).unwrap();
  session.preview(&mut conn).unwrap();
  session.confirm(&mut conn).unwrap();
  conn
}

fn custom(lr_count: usize, passages: usize, questions: usize) -> Config {
  Config {
    section: None,
    passage_count: Some(passages),
    custom: Some(Custom {
      lr_count,
      subset: Subset::Any,
      exclude_correct: false,
      shuffle_questions: false,
      shuffle_answers: false,
    }),
    ..config(Explanations::AtEnd, questions)
  }
}

fn with(mut config: Config, change: impl Fn(&mut Custom)) -> Config {
  change(config.custom.as_mut().unwrap());
  config
}

fn words(ids: &str) -> Vec<String> {
  ids.split_whitespace().map(String::from).collect()
}

/// Submits one answer to a question, in its own session.
fn answer(conn: &mut Connection, id: &str, choice: Label) {
  let session = if id.starts_with('q') {
    create(conn, &custom(1, 0, 1), &words(id)).unwrap()
  } else {
    create(conn, &custom(0, 1, 3), &words("z a m")).unwrap()
  };
  let question = session.questions.iter().find(|question| question.question_id == id).unwrap();
  select(conn, &question.id, Some(choice)).unwrap();
  finish(conn, &session.id).unwrap();
}

fn allowed(conn: &mut Connection, config: &Config, ids: &str) -> bool {
  match create(conn, config, &words(ids)) {
    Ok(session) => {
      abandon(conn, &session.id).unwrap();
      true
    }
    Err(PracticeError::Refused(_)) => false,
    Err(error) => panic!("{error}"),
  }
}

#[test]
fn mixes_lr_questions_and_whole_passages() {
  let dir = TempDir::new();
  let mut conn = mixed_database(&dir);
  assert!(allowed(&mut conn, &custom(2, 1, 4), "q3 q1 b c"));
  assert!(allowed(&mut conn, &custom(2, 0, 2), "q3 q1"));
  assert!(allowed(&mut conn, &custom(0, 2, 5), "b c z a m"));
  for (config, ids) in [
    (custom(2, 1, 4), "b c q3 q1"),
    (custom(2, 1, 4), "q3 b c q1"),
    (custom(1, 1, 4), "q3 q1 b c"),
    (custom(2, 0, 4), "q3 q1 b c"),
    (custom(2, 2, 4), "q3 q1 b c"),
    (custom(2, 1, 3), "q3 q1 b"),
    (custom(2, 1, 4), "q3 q1 c b"),
    (custom(2, 0, 2), "q1 q1"),
    (custom(0, 0, 0), ""),
  ] {
    assert!(!allowed(&mut conn, &config, ids), "{ids}");
  }
  let with_section = Config { section: Some(Section::LogicalReasoning), ..custom(1, 0, 1) };
  assert!(!allowed(&mut conn, &with_section, "q1"));
  let without_custom = Config { custom: None, ..custom(1, 0, 1) };
  assert!(!allowed(&mut conn, &without_custom, "q1"));
}

#[test]
fn custom_categories_apply_within_their_own_section() {
  let dir = TempDir::new();
  let mut conn = mixed_database(&dir);
  let chosen = |ids: &str| Config { category_ids: words(ids), ..custom(1, 1, 3) };
  assert!(allowed(&mut conn, &chosen("lr-flaw"), "q1 b c"));
  assert!(!allowed(&mut conn, &chosen("lr-flaw"), "q3 b c"));
  assert!(allowed(&mut conn, &chosen("rc-structure"), "q3 b c"));
  let z = Config { question_count: 4, ..chosen("rc-structure") };
  assert!(!allowed(&mut conn, &z, "q3 z a m"));
  assert!(!allowed(&mut conn, &chosen("lr-weaken rc-structure"), "q1 b c"));
  assert!(!allowed(&mut conn, &chosen("missing"), "q1 b c"));
}

#[test]
fn subsets_use_the_most_recent_attempt() {
  let dir = TempDir::new();
  let mut conn = mixed_database(&dir);
  answer(&mut conn, "q1", Label::C);
  answer(&mut conn, "q2", Label::A);
  // q3: right, then wrong. q4: wrong, then right.
  for (id, first, second) in [("q3", Label::C, Label::B), ("q4", Label::D, Label::C)] {
    answer(&mut conn, id, first);
    answer(&mut conn, id, second);
  }
  // Only the order of these decides which is most recent.
  let times: i64 = conn
    .query_row("SELECT count(DISTINCT question_id) FROM attempts", [], |row| row.get(0))
    .unwrap();
  assert_eq!(times, 4);
  let found = |conn: &mut Connection, subset: Subset, exclude_correct: bool| -> String {
    let config = with(custom(1, 0, 1), |custom| {
      custom.subset = subset;
      custom.exclude_correct = exclude_correct;
    });
    ["q1", "q2", "q3", "q4"].into_iter().filter(|id| allowed(conn, &config, id)).collect()
  };
  assert_eq!(found(&mut conn, Subset::Any, false), "q1q2q3q4");
  assert_eq!(found(&mut conn, Subset::Any, true), "q2q3");
  assert_eq!(found(&mut conn, Subset::Missed, false), "q2q3");
  assert_eq!(found(&mut conn, Subset::New, false), "");
  set_bookmark(&mut conn, "q1", true).unwrap();
  set_bookmark(&mut conn, "q3", true).unwrap();
  assert_eq!(found(&mut conn, Subset::Bookmarked, false), "q1q3");
  assert_eq!(found(&mut conn, Subset::Bookmarked, true), "q3");
}

#[test]
fn seeing_a_question_without_answering_keeps_it_new() {
  let dir = TempDir::new();
  let mut conn = mixed_database(&dir);
  let session = create(&mut conn, &custom(2, 0, 2), &words("q1 q2")).unwrap();
  select(&mut conn, &session.questions[0].id, Some(Label::A)).unwrap();
  abandon(&mut conn, &session.id).unwrap();
  let new = with(custom(2, 0, 2), |custom| custom.subset = Subset::New);
  assert!(allowed(&mut conn, &new, "q1 q2"));
}

#[test]
fn a_passage_qualifies_if_any_question_does() {
  let dir = TempDir::new();
  let mut conn = mixed_database(&dir);
  answer(&mut conn, "a", Label::B);
  let missed = with(custom(0, 1, 3), |custom| custom.subset = Subset::Missed);
  assert!(allowed(&mut conn, &missed, "z a m"));
  let other = with(custom(0, 1, 2), |custom| custom.subset = Subset::Missed);
  assert!(!allowed(&mut conn, &other, "b c"));
  // The missed question must be the one that matches the category.
  let detail = Config { category_ids: words("rc-detail"), ..missed.clone() };
  assert!(!allowed(&mut conn, &detail, "z a m"));
  let main = Config { category_ids: words("rc-main-idea"), ..missed };
  assert!(allowed(&mut conn, &main, "z a m"));
}

#[test]
fn custom_sessions_are_unfinished_separately() {
  let dir = TempDir::new();
  let mut conn = mixed_database(&dir);
  let first = create(&mut conn, &custom(1, 0, 1), &words("q1")).unwrap();
  let lr = create(&mut conn, &config(Explanations::AtEnd, 1), &words("q2")).unwrap();
  let rc = rc_create(&mut conn, &rc_config(1, 2), "bc").unwrap();
  assert!(refusal(create(&mut conn, &custom(1, 0, 1), &words("q3"))).contains("current session"));
  assert_eq!(unfinished(&conn, None).unwrap(), Some(first));
  assert_eq!(unfinished(&conn, Some(Section::LogicalReasoning)).unwrap(), Some(lr));
  assert_eq!(unfinished(&conn, Some(Section::ReadingComprehension)).unwrap(), Some(rc));
  let kind: String = conn
    .query_row("SELECT session_type FROM practice_sessions ORDER BY rowid LIMIT 1", [], |row| row.get(0))
    .unwrap();
  assert_eq!(kind, "custom");
}

// ---------------------------------------------------------------- Shuffled answers

fn shuffled(conn: &mut Connection, id: &str) -> Session {
  let config = with(custom(1, 0, 1), |custom| custom.shuffle_answers = true);
  let mut config = config;
  config.explanations = Explanations::AfterEach;
  create(conn, &config, &words(id)).unwrap()
}

fn texts(question: &SessionQuestion) -> String {
  question.choices.iter().map(|choice| choice.text.as_str()).collect::<Vec<_>>().join(" ")
}

#[test]
fn shuffled_answers_stay_consistent_on_screen_and_in_records() {
  let dir = TempDir::new();
  let mut conn = mixed_database(&dir);
  for _ in 0..30 {
    for wanted in ["one", "three"] {
      let session = shuffled(&mut conn, "q1");
      let question = &session.questions[0];
      let labels: Vec<_> = question.choices.iter().map(|choice| choice.label).collect();
      assert_eq!(labels, crate::import::package::LABELS);
      let picked = question.choices.iter().find(|choice| choice.text == wanted).unwrap().label;
      select(&mut conn, &question.id, Some(picked)).unwrap();
      let resumed = unfinished(&conn, None).unwrap().unwrap();
      assert_eq!(resumed.questions[0].choices, question.choices);
      assert_eq!(resumed.questions[0].selected, Some(picked));

      let checked = submit(&mut conn, &question.id).unwrap();
      let outcome = checked.questions[0].outcome.as_ref().unwrap();
      assert_eq!(outcome.is_correct, Some(wanted == "three"));
      // Each explanation sits with its own choice, and the key with the right text.
      for choice in &question.choices {
        assert_eq!(outcome.explanations.get(choice.label), format!("Why {}.", choice.text));
        assert_eq!(choice.label == outcome.correct_choice, choice.text == "three");
      }
      finish(&mut conn, &session.id).unwrap();
      let recorded = attempts(&conn).pop().unwrap();
      assert_eq!(recorded.0, if wanted == "three" { "q1:C" } else { "q1:A" });
      assert_eq!(recorded.1, wanted == "three");
    }
  }
}

#[test]
fn every_choice_reaches_every_position() {
  let dir = TempDir::new();
  let mut conn = mixed_database(&dir);
  let mut seen = BTreeSet::new();
  for _ in 0..150 {
    let session = shuffled(&mut conn, "q2");
    for choice in &session.questions[0].choices {
      seen.insert(format!("{}{}", choice.label.as_str(), choice.text));
    }
    abandon(&mut conn, &session.id).unwrap();
  }
  assert_eq!(seen.len(), 25);
}

#[test]
fn questions_that_mention_choices_are_not_shuffled() {
  let dir = TempDir::new();
  let mut conn = mixed_database(&dir);
  for _ in 0..20 {
    let session = shuffled(&mut conn, "q4");
    assert_eq!(texts(&session.questions[0]), "one two three four five");
    abandon(&mut conn, &session.id).unwrap();
  }
}

#[test]
fn answers_are_not_shuffled_unless_chosen() {
  let dir = TempDir::new();
  let mut conn = mixed_database(&dir);
  for _ in 0..20 {
    let session = create(&mut conn, &custom(1, 0, 1), &words("q1")).unwrap();
    assert_eq!(texts(&session.questions[0]), "one two three four five");
    abandon(&mut conn, &session.id).unwrap();
  }
}

#[test]
fn sessions_saved_before_shuffling_existed_still_open() {
  let dir = TempDir::new();
  let mut conn = mixed_database(&dir);
  let session = create(&mut conn, &custom(1, 0, 1), &words("q1")).unwrap();
  select(&mut conn, &session.questions[0].id, Some(Label::D)).unwrap();
  let mut old: Value = conn
    .query_row("SELECT content_snapshot_json FROM session_questions", [], |row| from_json(row, 0))
    .unwrap();
  old.as_object_mut().unwrap().remove("choice_order").unwrap();
  let snapshot: Snapshot = serde_json::from_value(old).unwrap();
  assert_eq!(snapshot.choice_order, unshuffled());
}
