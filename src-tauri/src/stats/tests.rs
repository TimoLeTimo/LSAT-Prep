use std::time::{Duration, Instant};

use rusqlite::Connection;

use super::*;
use crate::{
  db::test_support::TempDir,
  import::package::{Label, Section},
  practice::{
    Clock, Config, Custom, ExamKind, Explanations, Session, Status, Subset, abandon, create,
    exam::{self, ExamClock, NewSection, Now},
    finish, load, select, set_bookmark, submit, tests::mixed_database, unfinished,
    unfinished_review,
  },
};

fn words(ids: &str) -> Vec<String> {
  ids.split_whitespace().map(String::from).collect()
}

fn config(questions: usize) -> Config {
  Config {
    section: None,
    category_ids: vec![],
    difficulties: vec![],
    question_count: questions,
    explanations: Explanations::AfterEach,
    passage_count: None,
    time_limit_seconds: None,
    custom: None,
    exam: None,
    review: false,
  }
}

/// A custom session of LR questions q1-q4, whose key is always C.
fn practice(conn: &mut Connection, ids: &str) -> Session {
  let ids = words(ids);
  let custom = Custom {
    lr_count: ids.len(),
    subset: Subset::Any,
    exclude_correct: false,
    shuffle_questions: false,
    shuffle_answers: false,
  };
  create(conn, &Config { custom: Some(custom), ..config(ids.len()) }, &ids).unwrap()
}

fn review(conn: &mut Connection, ids: &str) -> Result<Session, PracticeError> {
  let ids = words(ids);
  create(conn, &Config { review: true, ..config(ids.len()) }, &ids)
}

fn answer(conn: &mut Connection, session: &Session, choices: &[Option<Label>]) {
  for (question, choice) in session.questions.iter().zip(choices) {
    if choice.is_some() {
      select(conn, &question.id, *choice).unwrap();
    }
  }
}

fn is_refused<T>(result: Result<T, PracticeError>) -> bool {
  matches!(result, Err(PracticeError::Refused(_)))
}

const C: Option<Label> = Some(Label::C);
const A: Option<Label> = Some(Label::A);

// ---------------------------------------------------------------- Records

#[test]
fn every_submitted_answer_is_one_record() {
  let dir = TempDir::new();
  let mut conn = mixed_database(&dir);
  let session = practice(&mut conn, "q1 q2 q3");
  answer(&mut conn, &session, &[C, A, None]);
  finish(&mut conn, &session.id).unwrap();
  let found = records(&conn).unwrap();
  let answers: Vec<_> =
    found.answers.iter().map(|record| (record.question_id.as_str(), record.is_correct)).collect();
  assert_eq!(answers, [("q1", true), ("q2", false)]);
  let first = &found.answers[0];
  assert_eq!(
    (first.section.as_str(), first.category_id.as_str(), first.category_name.as_str(), first.difficulty),
    ("logical_reasoning", "lr-flaw", "Flaw", 2)
  );
  let session = &found.sessions[0];
  assert_eq!((session.questions, session.answered, session.correct), (3, 2, 1));
  assert_eq!((session.session_type.as_str(), session.status.as_str()), ("custom", "completed"));
}

#[test]
fn records_describe_questions_as_they_were_answered() {
  let dir = TempDir::new();
  let mut conn = mixed_database(&dir);
  let session = practice(&mut conn, "q1");
  answer(&mut conn, &session, &[C]);
  finish(&mut conn, &session.id).unwrap();
  let before = records(&conn).unwrap();
  conn
    .execute_batch(
      "UPDATE questions SET difficulty = 4, category_id = 'lr-weaken', status = 'retired' WHERE id = 'q1';
       UPDATE question_categories SET name = 'changed';",
    )
    .unwrap();
  assert_eq!(records(&conn).unwrap(), before);
}

#[test]
fn abandoned_sessions_keep_only_checked_answers() {
  let dir = TempDir::new();
  let mut conn = mixed_database(&dir);
  let session = practice(&mut conn, "q1 q2");
  answer(&mut conn, &session, &[C, C]);
  submit(&mut conn, &session.questions[0].id).unwrap();
  abandon(&mut conn, &session.id).unwrap();
  let found = records(&conn).unwrap();
  assert_eq!(found.answers.len(), 1);
  assert_eq!((found.sessions[0].answered, found.sessions[0].status.as_str()), (1, "abandoned"));
}

#[test]
fn practice_time_is_clock_time() {
  let dir = TempDir::new();
  let mut conn = mixed_database(&dir);
  let session = practice(&mut conn, "q1");
  let start = Instant::now();
  let mut clock = Clock::default();
  clock.start(&mut conn, &session.id, start).unwrap();
  clock.pause(&mut conn, &session.id, start + Duration::from_secs(12)).unwrap();
  clock.save(&mut conn, &session.id, start + Duration::from_secs(900)).unwrap();
  assert_eq!(records(&conn).unwrap().sessions[0].practice_ms, 12_000);
}

#[test]
fn exam_scores_leave_out_unscored_questions_but_answers_do_not() {
  let dir = TempDir::new();
  let mut conn = mixed_database(&dir);
  let section = |ids: &str, unscored: &str| NewSection {
    section: Section::LogicalReasoning,
    time_limit_seconds: 600,
    break_after_seconds: 60,
    question_ids: words(ids),
    unscored_ids: words(unscored),
  };
  let sections = [section("q1 q2", "q2"), section("q3 q4", "")];
  let id = exam::create(&mut conn, ExamKind::FullSimulation, "Mock", &sections).unwrap();
  let start = Now::get();
  let at = |seconds: i64| Now {
    instant: start.instant + Duration::from_secs(seconds as u64),
    wall_ms: start.wall_ms + seconds * 1000,
  };
  let mut clock = ExamClock::default();
  let first = clock.start_section(&mut conn, &id, at(0)).unwrap();
  answer(&mut conn, &first.session, &[C, C]);

  // In progress: nothing hidden is revealed, and nothing is an answer yet.
  let found = records(&conn).unwrap();
  assert!(found.answers.is_empty());
  assert_eq!((found.sessions[0].scored_questions, found.sessions[0].answered), (4, 0));
  assert!(exam::results(&conn, &id, at(1)).is_err());

  clock.end_section(&mut conn, &id, 0, at(30)).unwrap();
  let second = clock.start_section(&mut conn, &id, at(95)).unwrap();
  answer(&mut conn, &second.session, &[A, None]);
  clock.end_section(&mut conn, &id, 1, at(115)).unwrap();
  let found = records(&conn).unwrap();
  assert_eq!(found.answers.len(), 3, "the unscored answer counts as practice");
  let record = &found.sessions[0];
  assert_eq!((record.questions, record.answered, record.correct), (4, 3, 2));
  assert_eq!((record.scored_questions, record.scored_correct), (3, 1));
  assert_eq!(record.practice_ms, 50_000, "30 s and 20 s, without the break");
  assert_eq!((record.name.as_deref(), record.section.as_deref()), (Some("Mock"), None));
  assert_eq!(exam::results(&conn, &id, at(120)).unwrap().session.questions.len(), 4);
}

#[test]
fn records_agree_with_the_attempts() {
  let dir = TempDir::new();
  let mut conn = mixed_database(&dir);
  for (ids, choices) in [("q1 q2", [C, A]), ("q2 q3", [C, None]), ("q1 q4", [A, A])] {
    let session = practice(&mut conn, ids);
    answer(&mut conn, &session, &choices);
    finish(&mut conn, &session.id).unwrap();
  }
  let (total, correct): (i64, i64) = conn
    .query_row("SELECT count(*), sum(is_correct) FROM attempts", [], |row| Ok((row.get(0)?, row.get(1)?)))
    .unwrap();
  let found = records(&conn).unwrap();
  assert_eq!(found.answers.len() as i64, total);
  assert_eq!(found.answers.iter().filter(|record| record.is_correct).count() as i64, correct);
  assert_eq!(found.sessions.iter().map(|session| session.answered).sum::<i64>(), total);
  assert_eq!(found.sessions.iter().map(|session| session.correct).sum::<i64>(), correct);
}

// ---------------------------------------------------------------- Retrying

#[test]
fn a_retry_is_separate_and_leaves_the_original_unchanged() {
  let dir = TempDir::new();
  let mut conn = mixed_database(&dir);
  let original = practice(&mut conn, "q1");
  answer(&mut conn, &original, &[A]);
  let original = finish(&mut conn, &original.id).unwrap();

  let retry = review(&mut conn, "q1").unwrap();
  assert!(retry.questions[0].outcome.is_none(), "the answer is hidden until checked");
  assert_eq!(unfinished_review(&conn).unwrap().as_ref(), Some(&retry));
  assert_eq!(unfinished(&conn, None).unwrap(), None, "not a custom session");
  answer(&mut conn, &retry, &[C]);
  submit(&mut conn, &retry.questions[0].id).unwrap();
  finish(&mut conn, &retry.id).unwrap();

  assert_eq!(load(&conn, &original.id).unwrap(), original);
  let found = records(&conn).unwrap();
  let kinds: Vec<_> =
    found.answers.iter().map(|record| (record.is_retry, record.is_correct)).collect();
  assert_eq!(kinds, [(false, false), (true, true)]);
  assert_eq!(found.sessions[1].session_type, "review");
  assert_eq!(review_items(&conn).unwrap()[0].last_correct, Some(true));
}

#[test]
fn a_first_answer_in_review_is_not_a_retry() {
  let dir = TempDir::new();
  let mut conn = mixed_database(&dir);
  set_bookmark(&mut conn, "q1", true).unwrap();
  let session = review(&mut conn, "q1").unwrap();
  answer(&mut conn, &session, &[C]);
  finish(&mut conn, &session.id).unwrap();
  assert!(!records(&conn).unwrap().answers[0].is_retry);
  // And practicing again outside Review is not one either.
  let session = practice(&mut conn, "q1");
  answer(&mut conn, &session, &[C]);
  finish(&mut conn, &session.id).unwrap();
  assert!(records(&conn).unwrap().answers.iter().all(|record| !record.is_retry));
}

#[test]
fn only_answered_or_bookmarked_questions_can_be_reviewed() {
  let dir = TempDir::new();
  let mut conn = mixed_database(&dir);
  assert!(is_refused(review(&mut conn, "q1")));
  for id in ["q1", "q2", "z", "m", "b"] {
    set_bookmark(&mut conn, id, true).unwrap();
  }
  // Part of a passage is allowed, but one passage's questions stay together, after LR.
  for (ids, allowed) in [
    ("q1 q2", true),
    ("q2 z m b", true),
    ("z b m", false),
    ("z q1", false),
    ("q1 q1", false),
    ("q1 a", false),
  ] {
    match review(&mut conn, ids) {
      Ok(session) => {
        assert!(allowed, "{ids}");
        assert!(is_refused(review(&mut conn, "q1")), "one at a time");
        abandon(&mut conn, &session.id).unwrap();
      }
      Err(error) => assert!(!allowed, "{ids}: {error}"),
    }
  }
  conn.execute("UPDATE questions SET status = 'retired' WHERE id = 'q1'", []).unwrap();
  assert!(is_refused(review(&mut conn, "q1")));
  let timed = Config { review: true, time_limit_seconds: Some(60), ..config(1) };
  assert!(is_refused(create(&mut conn, &timed, &words("q2"))));
  let at_end = Config { review: true, explanations: Explanations::AtEnd, ..config(1) };
  assert!(is_refused(create(&mut conn, &at_end, &words("q2"))));
}

// ---------------------------------------------------------------- Review lists

#[test]
fn lists_what_was_answered_or_bookmarked() {
  let dir = TempDir::new();
  let mut conn = mixed_database(&dir);
  assert!(review_items(&conn).unwrap().is_empty());
  for choices in [[C, A], [A, C]] {
    let session = practice(&mut conn, "q1 q2");
    answer(&mut conn, &session, &choices);
    finish(&mut conn, &session.id).unwrap();
  }
  set_bookmark(&mut conn, "b", true).unwrap();
  // Seen, but not submitted.
  let seen = practice(&mut conn, "q3");
  abandon(&mut conn, &seen.id).unwrap();
  conn.execute("UPDATE questions SET status = 'retired' WHERE id = 'q2'", []).unwrap();
  let items = review_items(&conn).unwrap();
  let found: Vec<_> = items
    .iter()
    .map(|item| (item.question_id.as_str(), item.times_answered, item.last_correct, item.is_bookmarked, item.can_retry))
    .collect();
  assert_eq!(
    found,
    [
      ("b", 0, None, true, true),
      ("q1", 2, Some(false), false, true),
      ("q2", 2, Some(true), false, false),
    ]
  );
  assert!(items[1].last_answered_at.is_some() && items[0].last_answered_at.is_none());
  assert_eq!(items[0].passage_id.as_deref(), Some("p2"));
}

#[test]
fn history_shows_each_answer_as_it_was_newest_first() {
  let dir = TempDir::new();
  let mut conn = mixed_database(&dir);
  let first = practice(&mut conn, "q1 q2");
  answer(&mut conn, &first, &[A, C]);
  finish(&mut conn, &first.id).unwrap();
  conn.execute("UPDATE questions SET prompt = 'revised' WHERE id = 'q1'", []).unwrap();
  let retry = review(&mut conn, "q1").unwrap();
  answer(&mut conn, &retry, &[C]);
  submit(&mut conn, &retry.questions[0].id).unwrap();
  let history = question_history(&conn, "q1").unwrap();
  let found: Vec<_> = history
    .iter()
    .map(|past| (past.is_retry, past.session_type.as_str(), past.question.selected, past.question.prompt == "revised"))
    .collect();
  assert_eq!(found, [(true, "review", C, true), (false, "custom", A, false)]);
  assert!(history.iter().all(|past| past.question.outcome.is_some()));
  assert!(question_history(&conn, "q3").unwrap().is_empty());
  assert_eq!(load(&conn, &retry.id).unwrap().status, Status::InProgress);
}
