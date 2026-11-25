use std::time::{Duration, Instant};

use super::{
  exam::{Exam, ExamClock, NewSection, Now, Phase, SectionStatus, create, latest},
  tests::{attempts, mixed_database, refusal, words},
  *,
};
use crate::db::{self, test_support::TempDir};

/// A fixed moment, `seconds` after the start of the test.
#[derive(Clone, Copy)]
struct Time(Instant);

impl Time {
  fn at(self, seconds: f64) -> Now {
    Now {
      instant: self.0 + Duration::from_secs_f64(seconds),
      wall_ms: 1_800_000_000_000 + (seconds * 1000.0) as i64,
    }
  }
}

fn lr(ids: &str, seconds: i64, rest: i64) -> NewSection {
  NewSection {
    section: Section::LogicalReasoning,
    time_limit_seconds: seconds,
    break_after_seconds: rest,
    question_ids: words(ids),
    unscored_ids: vec![],
  }
}

fn rc(ids: &str, seconds: i64, rest: i64) -> NewSection {
  NewSection { section: Section::ReadingComprehension, ..lr(ids, seconds, rest) }
}

/// LR (100 s, then a 60 s break), RC (100 s), LR (100 s, unscored q3).
fn sections() -> Vec<NewSection> {
  let mut last = lr("q3 q4", 100, 60);
  last.unscored_ids = words("q3");
  vec![lr("q1 q2", 100, 60), rc("b c", 100, 0), last]
}

struct Setup {
  _dir: TempDir,
  conn: Connection,
  clock: ExamClock,
  id: String,
  time: Time,
}

fn setup(kind: ExamKind) -> Setup {
  let dir = TempDir::new();
  let mut conn = mixed_database(&dir);
  let id = create(&mut conn, kind, "Mini", &sections()).unwrap();
  Setup { _dir: dir, conn, clock: ExamClock::default(), id, time: Time(Instant::now()) }
}

impl Setup {
  fn save(&mut self, seconds: f64) -> Exam {
    self.clock.save(&mut self.conn, &self.id, self.time.at(seconds)).unwrap()
  }
  fn start(&mut self, seconds: f64) -> Exam {
    self.clock.start_section(&mut self.conn, &self.id, self.time.at(seconds)).unwrap()
  }
  fn try_start(&mut self, seconds: f64) -> super::Result<Exam> {
    self.clock.start_section(&mut self.conn, &self.id, self.time.at(seconds))
  }
  fn end(&mut self, position: i64, seconds: f64) -> Exam {
    self.clock.end_section(&mut self.conn, &self.id, position, self.time.at(seconds)).unwrap()
  }
  fn answer(&mut self, question: &str, choice: Label, seconds: f64) -> super::Result<()> {
    self.clock.require_time(&mut self.conn, question, self.time.at(seconds))?;
    select(&mut self.conn, question, Some(choice))
  }
  fn question(&self, id: &str) -> String {
    self
      .conn
      .query_row(
        "SELECT id FROM session_questions WHERE session_id = ?1 AND question_id = ?2",
        [&self.id, id],
        |row| row.get(0),
      )
      .unwrap()
  }
}

fn section(position: i64, remaining_ms: i64) -> Phase {
  Phase::Section { position, remaining_ms }
}

fn shown(exam: &Exam) -> String {
  exam.session.questions.iter().map(|question| question.question_id.as_str()).collect()
}

const BOTH: [ExamKind; 2] = [ExamKind::Test, ExamKind::FullSimulation];

// ---------------------------------------------------------------- Creating

#[test]
fn refuses_exams_that_break_the_rules() {
  let dir = TempDir::new();
  let mut conn = mixed_database(&dir);
  let mut wrong_unscored = lr("q1", 100, 0);
  wrong_unscored.unscored_ids = words("q2");
  for (sections, expected) in [
    (vec![], "1 to 10"),
    (vec![lr("q1", 100, 0); 11], "1 to 10"),
    (vec![lr("", 100, 0)], "needs questions"),
    (vec![lr("q1 q1", 100, 0)], "twice"),
    (vec![lr("q1", 100, 0), lr("q1", 100, 0)], "twice"),
    (vec![rc("b c", 100, 0), rc("b c", 100, 0)], "twice"),
    (vec![lr("q1", 59, 0)], "section time"),
    (vec![lr("q1", 21601, 0)], "section time"),
    (vec![lr("q1", 100, -1)], "break"),
    (vec![lr("q1", 100, 3601)], "break"),
    (vec![wrong_unscored], "not in its section"),
    (vec![lr("q1 b c", 100, 0)], "wrong kind"),
    (vec![rc("q1", 100, 0)], "wrong kind"),
    (vec![rc("b", 100, 0)], "all of its questions"),
    (vec![rc("c b", 100, 0)], "all of its questions"),
    (vec![rc("b c", 100, 0), rc("z a", 100, 0)], "all of its questions"),
    (vec![lr("missing", 100, 0)], "no longer available"),
  ] {
    let reason = refusal(create(&mut conn, ExamKind::Test, "x", &sections));
    assert!(reason.contains(expected), "{expected}: {reason}");
  }
  for name in ["", "  ", "a\nb", &"x".repeat(101)] {
    assert!(refusal(create(&mut conn, ExamKind::Test, name, &sections())).contains("name"));
  }
  let left: i64 = conn
    .query_row("SELECT (SELECT count(*) FROM practice_sessions) + (SELECT count(*) FROM exam_sections)", [], |row| row.get(0))
    .unwrap();
  assert_eq!(left, 0);
}

#[test]
fn only_one_exam_can_be_unfinished_and_practice_is_separate() {
  for kind in BOTH {
    let mut t = setup(kind);
    for other in BOTH {
      assert!(refusal(create(&mut t.conn, other, "x", &sections())).contains("current exam"));
    }
    assert_eq!(unfinished(&t.conn, None).unwrap(), None);
    assert_eq!(unfinished(&t.conn, Some(Section::LogicalReasoning)).unwrap(), None);
    abandon(&mut t.conn, &t.id).unwrap();
    assert_eq!(t.clock.unfinished(&mut t.conn, t.time.at(0.0)).unwrap(), None);
    create(&mut t.conn, kind, "x", &sections()).unwrap();
  }
}

// ---------------------------------------------------------------- Moving through sections

#[test]
fn shows_only_the_active_section_and_reveals_everything_at_the_end() {
  for kind in BOTH {
    let mut t = setup(kind);
    assert_eq!(shown(&t.save(0.0)), "");
    assert_eq!(t.save(0.0).phase, Phase::Ready { position: 0 });
    let first = t.start(0.0);
    assert_eq!((shown(&first).as_str(), first.phase), ("q1q2", section(0, 100_000)));
    let text = serde_json::to_string(&first).unwrap();
    for hidden in ["\"b\"", "\"is_scored\":true", "\"is_scored\":false", "Why three"] {
      assert!(!text.contains(hidden), "{hidden}");
    }
    assert_eq!(first.session.current_position, 0);
    let rest = t.end(0, 10.0);
    assert_eq!(shown(&rest), "");
    assert_eq!(
      rest.phase,
      Phase::Break { next_position: 1, remaining_ms: 60_000, can_skip: kind == ExamKind::Test }
    );
    let second = t.start(70.0);
    assert_eq!((shown(&second).as_str(), second.session.current_position), ("bc", 2));
    // No break after this one.
    assert_eq!(t.end(1, 80.0).phase, Phase::Ready { position: 2 });
    assert_eq!(shown(&t.start(85.0)), "q3q4");
    // No break after the last, even though one was asked for.
    let done = t.end(2, 90.0);
    assert_eq!((done.phase, done.session.status), (Phase::Ended, Status::Completed));
    assert_eq!(shown(&done), "q1q2bcq3q4");
    let scored: Vec<_> = done.session.questions.iter().map(|q| q.is_scored.unwrap()).collect();
    assert_eq!(scored, [true, true, true, true, false, true]);
  }
}

#[test]
fn finishing_submits_saved_answers_from_every_section() {
  for kind in BOTH {
    let mut t = setup(kind);
    t.start(0.0);
    let q1 = t.question("q1");
    t.answer(&q1, Label::C, 1.0).unwrap();
    t.end(0, 2.0);
    t.start(62.0);
    assert!(attempts(&t.conn).is_empty(), "nothing is submitted before the end");
    let b = t.question("b");
    t.answer(&b, Label::A, 63.0).unwrap();
    t.end(1, 64.0);
    t.start(65.0);
    let q3 = t.question("q3");
    t.answer(&q3, Label::C, 66.0).unwrap();
    t.end(2, 67.0);
    let found: Vec<_> = attempts(&t.conn).into_iter().map(|(id, correct, _)| (id, correct)).collect();
    assert_eq!(found, [("q1:C".into(), true), ("b:A".into(), false), ("q3:C".into(), true)]);
  }
}

#[test]
fn closed_and_future_sections_cannot_be_changed() {
  for kind in BOTH {
    let mut t = setup(kind);
    let (q1, b) = (t.question("q1"), t.question("b"));
    let refuses_all = |t: &mut Setup, question: &str, order: i64, seconds: f64| {
      assert!(t.answer(question, Label::A, seconds).is_err());
      refusal(select(&mut t.conn, question, Some(Label::A)));
      refusal(set_flag(&mut t.conn, question, true));
      refusal(add_time(&mut t.conn, question, 1));
      refusal(set_position(&mut t.conn, &t.id, order));
    };
    refuses_all(&mut t, &q1, 0, 0.0);
    t.start(0.0);
    t.answer(&q1, Label::B, 1.0).unwrap();
    set_flag(&mut t.conn, &q1, true).unwrap();
    set_position(&mut t.conn, &t.id, 1).unwrap();
    refuses_all(&mut t, &b, 2, 1.0);
    t.end(0, 2.0);
    refuses_all(&mut t, &q1, 0, 3.0);
    t.start(62.0);
    refuses_all(&mut t, &q1, 0, 63.0);
    t.answer(&b, Label::D, 63.0).unwrap();
  }
}

#[test]
fn sections_must_be_taken_in_order() {
  for kind in BOTH {
    let mut t = setup(kind);
    let (id, now) = (t.id.clone(), t.time.at(0.0));
    assert!(refusal(t.clock.end_section(&mut t.conn, &id, 0, now)).contains("not in progress"));
    t.start(0.0);
    assert!(refusal(t.try_start(1.0)).contains("already in progress"));
    assert!(refusal(t.clock.end_section(&mut t.conn, &id, 1, now)).contains("not in progress"));
    t.end(0, 2.0);
    // A repeated request does not end the next section.
    assert!(matches!(t.end(0, 3.0).phase, Phase::Break { .. }));
    t.start(62.0);
    assert_eq!(t.end(0, 63.0).phase, section(1, 99_000));
    t.end(1, 64.0);
    t.start(65.0);
    t.end(2, 66.0);
    assert!(refusal(t.try_start(67.0)).contains("has ended"));
  }
}

#[test]
fn practice_rules_cannot_finish_an_exam_early() {
  for kind in BOTH {
    let mut t = setup(kind);
    t.start(0.0);
    let q1 = t.question("q1");
    t.answer(&q1, Label::C, 1.0).unwrap();
    refusal(finish(&mut t.conn, &t.id));
    refusal(submit(&mut t.conn, &q1));
    refusal(Clock::default().start(&mut t.conn, &t.id, Instant::now()));
    assert!(attempts(&t.conn).is_empty());
  }
}

#[test]
fn ending_an_exam_early_submits_nothing() {
  for kind in BOTH {
    let mut t = setup(kind);
    t.start(0.0);
    let q1 = t.question("q1");
    t.answer(&q1, Label::C, 1.0).unwrap();
    abandon(&mut t.conn, &t.id).unwrap();
    assert!(attempts(&t.conn).is_empty());
    let exam = t.save(500.0);
    assert_eq!((exam.phase, exam.session.status), (Phase::Ended, Status::Abandoned));
    assert!(exam.session.questions.iter().all(|q| q.outcome.is_none() && q.is_scored.is_none()));
    assert!(t.answer(&q1, Label::A, 2.0).is_err());
  }
}

// ---------------------------------------------------------------- Time

#[test]
fn time_running_out_ends_the_section_and_refuses_late_answers() {
  for kind in BOTH {
    let mut t = setup(kind);
    t.start(0.0);
    let q1 = t.question("q1");
    t.answer(&q1, Label::C, 99.9).unwrap();
    assert!(refusal(t.answer(&q1, Label::A, 100.0)).contains("has ended"));
    let exam = t.save(101.0);
    assert!(matches!(exam.phase, Phase::Break { next_position: 1, .. }));
    assert_eq!(exam.sections[0].status, SectionStatus::Done);
    let stored: String = t
      .conn
      .query_row("SELECT selected_choice_id FROM session_questions WHERE id = ?1", [&q1], |row| row.get(0))
      .unwrap();
    assert_eq!(stored, "q1:C");
  }
}

#[test]
fn time_running_out_in_the_last_section_finishes_the_exam() {
  for kind in BOTH {
    let mut t = setup(kind);
    t.start(0.0);
    t.end(0, 1.0);
    t.start(61.0);
    t.end(1, 62.0);
    t.start(63.0);
    let q3 = t.question("q3");
    t.answer(&q3, Label::C, 64.0).unwrap();
    let exam = t.save(163.0);
    assert_eq!((exam.phase, exam.session.status), (Phase::Ended, Status::Completed));
    assert_eq!(attempts(&t.conn).len(), 1);
    assert_eq!(t.save(170.0), exam);
  }
}

#[test]
fn a_test_pauses_while_away() {
  let mut t = setup(ExamKind::Test);
  t.start(0.0);
  let (id, q1) = (t.id.clone(), t.question("q1"));
  t.clock.leave(&mut t.conn, &id, t.time.at(10.0)).unwrap();
  assert_eq!(t.save(5000.0).phase, section(0, 90_000));
  assert!(refusal(t.answer(&q1, Label::A, 5000.0)).contains("paused"));
  assert_eq!(
    t.clock.open(&mut t.conn, &id, t.time.at(6000.0)).unwrap().phase,
    section(0, 90_000)
  );
  t.answer(&q1, Label::A, 6005.0).unwrap();
  assert_eq!(t.save(6010.0).phase, section(0, 80_000));
}

#[test]
fn a_simulation_keeps_running_while_away_or_closed() {
  let mut t = setup(ExamKind::FullSimulation);
  t.start(0.0);
  let id = t.id.clone();
  t.clock.leave(&mut t.conn, &id, t.time.at(10.0)).unwrap();
  // A new clock, as after restarting the app.
  let mut clock = ExamClock::default();
  let exam = clock.unfinished(&mut t.conn, t.time.at(40.0)).unwrap().unwrap();
  assert_eq!(exam.phase, section(0, 60_000));
  // Away long enough for the section and then the break to end.
  let exam = clock.unfinished(&mut t.conn, t.time.at(120.0)).unwrap().unwrap();
  let expected = Phase::Break { next_position: 1, remaining_ms: 40_000, can_skip: false };
  assert_eq!(exam.phase, expected, "the break began when time ran out");
  let exam = clock.open(&mut t.conn, &id, t.time.at(9000.0)).unwrap();
  assert_eq!(exam.phase, Phase::Ready { position: 1 }, "the next section waits for the user");
}

#[test]
fn sleep_counts_in_a_simulation_but_not_in_a_test() {
  for (kind, expected) in [(ExamKind::Test, 90_000), (ExamKind::FullSimulation, 60_000)] {
    let mut t = setup(kind);
    t.start(0.0);
    // Asleep for 30 of 40 seconds: the steady clock did not advance then.
    let woke = Now { instant: t.time.at(10.0).instant, wall_ms: t.time.at(40.0).wall_ms };
    let exam = t.clock.save(&mut t.conn, &t.id, woke).unwrap();
    assert_eq!(exam.phase, section(0, expected));
  }
}

#[test]
fn setting_the_computers_clock_back_gives_no_extra_time() {
  let mut t = setup(ExamKind::FullSimulation);
  t.start(0.0);
  assert_eq!(t.save(30.0).phase, section(0, 70_000));
  let back = |t: &Setup, seconds: f64| Now {
    instant: t.time.at(seconds).instant,
    wall_ms: t.time.at(0.0).wall_ms - 5_000_000,
  };
  let now = back(&t, 40.0);
  let exam = t.clock.save(&mut t.conn, &t.id, now).unwrap();
  assert_eq!(exam.phase, section(0, 60_000), "the timer keeps going");
  let now = back(&t, 50.0);
  let exam = t.clock.save(&mut t.conn, &t.id, now).unwrap();
  assert_eq!(exam.phase, section(0, 50_000));
  t.end(0, 60.0);
  let now = back(&t, 61.0);
  let exam = t.clock.save(&mut t.conn, &t.id, now).unwrap();
  let Phase::Break { remaining_ms, .. } = exam.phase else { panic!() };
  assert_eq!(remaining_ms, 60_000, "a break is never longer than planned");
}

#[test]
fn a_simulation_break_cannot_be_skipped_but_a_test_break_can() {
  let mut t = setup(ExamKind::FullSimulation);
  t.start(0.0);
  t.end(0, 10.0);
  assert!(refusal(t.try_start(69.9)).contains("not ended"));
  assert_eq!(t.save(70.0).phase, Phase::Ready { position: 1 });
  t.start(70.0);
  let mut t = setup(ExamKind::Test);
  t.start(0.0);
  t.end(0, 10.0);
  assert_eq!(t.start(11.0).phase, section(1, 100_000));
}

#[test]
fn frequent_saves_do_not_lose_fractions() {
  let mut t = setup(ExamKind::Test);
  t.start(0.0);
  for step in 1..=1000 {
    t.save(f64::from(step) * 0.0105);
  }
  assert_eq!(t.save(10.5).phase, section(0, 89_500));
}

#[test]
fn closing_the_app_saves_a_test() {
  let mut t = setup(ExamKind::Test);
  t.clock.leave_any(&mut t.conn, t.time.at(0.0)).unwrap();
  t.start(0.0);
  t.clock.leave_any(&mut t.conn, t.time.at(7.0)).unwrap();
  assert_eq!(t.save(99.0).phase, section(0, 93_000));
}

#[test]
fn an_exam_survives_without_a_clean_close() {
  for kind in BOTH {
    let mut t = setup(kind);
    t.start(0.0);
    let q1 = t.question("q1");
    t.answer(&q1, Label::B, 5.0).unwrap();
    let before = t.save(5.0);
    let after = TempDir::new();
    for name in ["lsat-prep.db", "lsat-prep.db-wal"] {
      std::fs::copy(t._dir.0.join(name), after.0.join(name)).unwrap();
    }
    let mut conn = db::open(&after.0).unwrap();
    let found = ExamClock::default().unfinished(&mut conn, t.time.at(5.0)).unwrap().unwrap();
    assert_eq!(found, before);
  }
}

#[test]
fn a_failed_final_save_undoes_everything_and_can_be_repeated() {
  for kind in BOTH {
    let mut t = setup(kind);
    t.start(0.0);
    let q1 = t.question("q1");
    t.answer(&q1, Label::C, 1.0).unwrap();
    t.end(0, 2.0);
    t.start(62.0);
    t.end(1, 63.0);
    t.start(64.0);
    t.conn
      .execute_batch(
        "CREATE TEMP TRIGGER fail BEFORE INSERT ON main.attempts
         BEGIN SELECT RAISE(ABORT, 'test'); END;",
      )
      .unwrap();
    let (id, late) = (t.id.clone(), t.time.at(200.0));
    assert!(matches!(t.clock.save(&mut t.conn, &id, late), Err(PracticeError::Failed(_))));
    assert_eq!(load(&t.conn, &id).unwrap().status, Status::InProgress);
    let q3 = t.question("q3");
    assert!(t.answer(&q3, Label::A, 200.0).is_err());
    t.conn.execute_batch("DROP TRIGGER fail;").unwrap();
    assert_eq!(t.save(201.0).session.status, Status::Completed);
  }
}

#[test]
fn the_latest_completed_exam_can_always_be_found() {
  for kind in BOTH {
    let mut t = setup(kind);
    let now = t.time.at(0.0);
    assert_eq!(latest(&t.conn, now).unwrap(), None);
    let finish_all = |t: &mut Setup| {
      t.start(0.0);
      t.end(0, 1.0);
      t.start(61.0);
      t.end(1, 62.0);
      t.start(63.0);
    };
    finish_all(&mut t);
    assert_eq!(latest(&t.conn, now).unwrap(), None, "not while in progress");
    // The last section runs out as the app closes, so no screen saw it end.
    t.clock.leave_any(&mut t.conn, t.time.at(500.0)).unwrap();
    assert_eq!(t.clock.unfinished(&mut t.conn, t.time.at(501.0)).unwrap(), None);
    let found = latest(&t.conn, t.time.at(501.0)).unwrap().unwrap();
    assert_eq!((found.phase, found.session.id.as_str()), (Phase::Ended, t.id.as_str()));
    assert!(found.session.questions.iter().all(|question| question.is_scored.is_some()));

    // An abandoned exam does not replace it, but a newer completed one does.
    let abandoned = create(&mut t.conn, kind, "x", &sections()).unwrap();
    abandon(&mut t.conn, &abandoned).unwrap();
    assert_eq!(latest(&t.conn, now).unwrap().unwrap().session.id, t.id);
    t.id = create(&mut t.conn, kind, "y", &sections()).unwrap();
    finish_all(&mut t);
    t.end(2, 64.0);
    assert_eq!(latest(&t.conn, now).unwrap().unwrap().session.id, t.id);
  }
}
