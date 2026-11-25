//! Tests and full simulations: timed sections taken in order, with breaks.
//!
//! A simulation's clock keeps running while the app is closed or asleep. A test's clock
//! pauses, like practice. Sections cannot be reopened, and nothing about the answers, or
//! which questions are unscored, is revealed until the whole exam is finished.

use std::{
  collections::BTreeSet,
  time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};

use rusqlite::{Connection, OptionalExtension, params};
use serde::{Deserialize, Serialize};

use super::{
  Config, ExamConfig, ExamKind, PracticeError, Result, Session, Snapshot, Status, begin,
  check_passage_sets, finish_in, from_text, insert_question, insert_session, load, require_active,
  session_of, take_snapshot,
};
use crate::import::package::Section;

const MAX_SECTIONS: usize = 10;
const MAX_QUESTIONS: usize = 500;
const SECTION_SECONDS: std::ops::RangeInclusive<i64> = 60..=6 * 60 * 60;
const BREAK_SECONDS: std::ops::RangeInclusive<i64> = 0..=60 * 60;

fn refused<T>(reason: &'static str) -> Result<T> {
  Err(PracticeError::Refused(reason))
}

/// Both clocks at one moment: wall time survives restarts, and `Instant` stops in sleep.
#[derive(Clone, Copy)]
pub struct Now {
  pub instant: Instant,
  pub wall_ms: i64,
}

impl Now {
  pub fn get() -> Self {
    let wall = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default();
    Now { instant: Instant::now(), wall_ms: wall.as_millis() as i64 }
  }
}

#[derive(Deserialize, Debug, Clone)]
#[serde(deny_unknown_fields)]
pub struct NewSection {
  pub section: Section,
  pub time_limit_seconds: i64,
  pub break_after_seconds: i64,
  pub question_ids: Vec<String>,
  pub unscored_ids: Vec<String>,
}

#[derive(Serialize, Debug, PartialEq)]
pub struct SectionView {
  pub position: i64,
  pub section: Section,
  pub time_limit_ms: i64,
  pub status: SectionStatus,
  pub question_count: i64,
}

#[derive(Serialize, Deserialize, Debug, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum SectionStatus {
  Waiting,
  Active,
  Done,
}

#[derive(Serialize, Debug, PartialEq, Clone, Copy)]
#[serde(tag = "name", rename_all = "snake_case")]
pub enum Phase {
  /// Waiting for the user to start this section.
  Ready { position: i64 },
  Section { position: i64, remaining_ms: i64 },
  Break { next_position: i64, remaining_ms: i64, can_skip: bool },
  Ended,
}

/// Everything the interface needs. While in progress, the session holds only the questions
/// of the active section.
#[derive(Serialize, Debug, PartialEq)]
pub struct Exam {
  pub session: Session,
  pub sections: Vec<SectionView>,
  pub phase: Phase,
}

// ---------------------------------------------------------------- Creating

pub fn create(
  conn: &mut Connection,
  kind: ExamKind,
  name: &str,
  sections: &[NewSection],
) -> Result<String> {
  let name = name.trim();
  if name.is_empty() || name.chars().count() > 100 || name.chars().any(char::is_control) {
    return refused("This exam needs a name of 1 to 100 characters.");
  }
  if sections.is_empty() || sections.len() > MAX_SECTIONS {
    return refused("An exam needs 1 to 10 sections.");
  }
  let all: Vec<&String> = sections.iter().flat_map(|section| &section.question_ids).collect();
  if all.len() > MAX_QUESTIONS || sections.iter().any(|section| section.question_ids.is_empty()) {
    return refused("Each section needs questions, up to 500 in all.");
  }
  if all.iter().collect::<BTreeSet<_>>().len() != all.len() {
    return refused("A question cannot appear twice in an exam.");
  }
  for section in sections {
    if !SECTION_SECONDS.contains(&section.time_limit_seconds) {
      return refused("Choose a section time from 1 to 360 minutes.");
    }
    if !BREAK_SECONDS.contains(&section.break_after_seconds) {
      return refused("Choose a break of up to 60 minutes.");
    }
    if section.unscored_ids.iter().any(|id| !section.question_ids.contains(id)) {
      return refused("An unscored question is not in its section.");
    }
  }

  let tx = begin(conn)?;
  if unfinished_id(&tx)?.is_some() {
    return refused("Finish or end your current exam first.");
  }
  let config = Config::exam(ExamConfig { kind, name: name.into() }, all.len());
  let id = insert_session(&tx, &config)?;
  let mut passages_seen = BTreeSet::new();
  let mut order = 0;
  for (position, section) in sections.iter().enumerate() {
    let snapshots = section
      .question_ids
      .iter()
      .map(|question_id| take_snapshot(&tx, question_id))
      .collect::<Result<Vec<_>>>()?;
    check_section(&tx, &config, section.section, &snapshots, &mut passages_seen)?;
    tx.execute(
      "INSERT INTO exam_sections (session_id, position, section, time_limit_ms, break_after_ms)
       VALUES (?1, ?2, ?3, ?4, ?5)",
      params![
        id,
        position as i64,
        section.section.as_str(),
        section.time_limit_seconds * 1000,
        // There is nothing to rest for after the last section.
        if position + 1 < sections.len() { section.break_after_seconds * 1000 } else { 0 }
      ],
    )?;
    for snapshot in &snapshots {
      let question_id = &snapshot.question.id;
      let question = insert_question(&tx, &id, snapshot, order)?;
      tx.execute(
        "UPDATE session_questions SET exam_section = ?2, is_scored = ?3 WHERE id = ?1",
        params![question, position as i64, !section.unscored_ids.contains(question_id)],
      )?;
      order += 1;
    }
  }
  tx.commit()?;
  Ok(id)
}

/// One kind of question per section, and whole passages that appear nowhere else.
fn check_section(
  conn: &Connection,
  config: &Config,
  section: Section,
  snapshots: &[Snapshot],
  passages_seen: &mut BTreeSet<String>,
) -> Result<()> {
  if snapshots.iter().any(|snapshot| snapshot.question.section != section) {
    return refused("A question is in the wrong kind of section.");
  }
  if section == Section::LogicalReasoning {
    return Ok(());
  }
  let passages: BTreeSet<_> =
    snapshots.iter().filter_map(|snapshot| snapshot.question.passage_id.clone()).collect();
  check_passage_sets(conn, config, snapshots, passages.len())?;
  if passages.into_iter().any(|passage| !passages_seen.insert(passage)) {
    return refused("A passage cannot appear twice in an exam.");
  }
  Ok(())
}

fn unfinished_id(conn: &Connection) -> rusqlite::Result<Option<String>> {
  conn
    .query_row(
      "SELECT id FROM practice_sessions WHERE status = 'in_progress'
         AND session_type IN ('test', 'full_simulation') ORDER BY created_at DESC LIMIT 1",
      [],
      |row| row.get(0),
    )
    .optional()
}

/// The most recently completed exam, so its results can be found even if the exam ended
/// while the user was away.
pub fn latest(conn: &Connection, now: Now) -> Result<Option<Exam>> {
  let id: Option<String> = conn
    .query_row(
      "SELECT id FROM practice_sessions WHERE status = 'completed'
         AND session_type IN ('test', 'full_simulation')
       ORDER BY completed_at DESC, rowid DESC LIMIT 1",
      [],
      |row| row.get(0),
    )
    .optional()?;
  id.map(|id| view(conn, &id, now)).transpose()
}

/// The results of one completed exam.
pub fn results(conn: &Connection, id: &str, now: Now) -> Result<Exam> {
  let exam = view(conn, id, now)?;
  if exam.session.status == Status::Completed {
    Ok(exam)
  } else {
    refused("This exam was not completed.")
  }
}

// ---------------------------------------------------------------- State

struct Row {
  position: i64,
  section: Section,
  time_limit_ms: i64,
  break_after_ms: i64,
  status: SectionStatus,
  elapsed_ms: i64,
  started_ms: Option<i64>,
  ended_ms: Option<i64>,
  question_count: i64,
}

fn rows(conn: &Connection, id: &str) -> rusqlite::Result<Vec<Row>> {
  conn
    .prepare_cached(
      "SELECT position, section, time_limit_ms, break_after_ms, status, elapsed_ms, started_ms,
         ended_ms, (SELECT count(*) FROM session_questions q
                    WHERE q.session_id = e.session_id AND q.exam_section = e.position)
       FROM exam_sections e WHERE session_id = ?1 ORDER BY position",
    )?
    .query_map([id], |row| {
      Ok(Row {
        position: row.get(0)?,
        section: from_text(row, 1)?,
        time_limit_ms: row.get(2)?,
        break_after_ms: row.get(3)?,
        status: from_text(row, 4)?,
        elapsed_ms: row.get(5)?,
        started_ms: row.get(6)?,
        ended_ms: row.get(7)?,
        question_count: row.get(8)?,
      })
    })?
    .collect()
}

fn phase(rows: &[Row], kind: ExamKind, now: Now) -> Phase {
  if let Some(active) = rows.iter().find(|row| row.status == SectionStatus::Active) {
    let remaining_ms = (active.time_limit_ms - active.elapsed_ms).max(0);
    return Phase::Section { position: active.position, remaining_ms };
  }
  let Some(next) = rows.iter().position(|row| row.status == SectionStatus::Waiting) else {
    return Phase::Ended;
  };
  let next_position = rows[next].position;
  if let Some(Row { break_after_ms, ended_ms: Some(ended), .. }) =
    next.checked_sub(1).map(|previous| &rows[previous])
  {
    // Capped, in case the computer's clock was set back.
    let remaining_ms = (ended + break_after_ms - now.wall_ms).min(*break_after_ms);
    if remaining_ms > 0 {
      let can_skip = kind == ExamKind::Test;
      return Phase::Break { next_position, remaining_ms, can_skip };
    }
  }
  Phase::Ready { position: next_position }
}

fn exam_config(conn: &Connection, id: &str) -> Result<ExamConfig> {
  load(conn, id)?.config.exam.ok_or(PracticeError::Refused("This session is not an exam."))
}

fn view(conn: &Connection, id: &str, now: Now) -> Result<Exam> {
  let session = load(conn, id)?;
  let Some(config) = &session.config.exam else {
    return refused("This session is not an exam.");
  };
  let rows = rows(conn, id)?;
  let phase = if session.status == Status::InProgress {
    phase(&rows, config.kind, now)
  } else {
    Phase::Ended
  };
  let sections = rows
    .into_iter()
    .map(|row| SectionView {
      position: row.position,
      section: row.section,
      time_limit_ms: row.time_limit_ms,
      status: row.status,
      question_count: row.question_count,
    })
    .collect();
  Ok(Exam { session, sections, phase })
}

/// Ends the active section. After the last one, submits every saved answer.
fn close(conn: &Connection, id: &str, position: i64, ended_ms: i64) -> Result<()> {
  conn.execute(
    "UPDATE exam_sections SET status = 'done', ended_ms = ?3
     WHERE session_id = ?1 AND position = ?2",
    params![id, position, ended_ms],
  )?;
  let waiting: bool = conn.query_row(
    "SELECT EXISTS (SELECT 1 FROM exam_sections WHERE session_id = ?1 AND status = 'waiting')",
    [id],
    |row| row.get(0),
  )?;
  if !waiting {
    finish_in(conn, id)?;
  }
  Ok(())
}

// ---------------------------------------------------------------- Clock

struct Running {
  session_id: String,
  saved_until: Instant,
}

/// Runs the active section while its screen is open. A simulation also counts wall time.
#[derive(Default)]
pub struct ExamClock(Option<Running>);

impl ExamClock {
  /// The exam to resume, if there is one. Does not start its clock.
  pub fn unfinished(&mut self, conn: &mut Connection, now: Now) -> Result<Option<Exam>> {
    match unfinished_id(conn)? {
      // Time may have run out while the app was closed.
      Some(id) => self.save(conn, &id, now).map(Some),
      None => Ok(None),
    }
  }

  /// The exam screen opened. Resumes the clock of a paused test.
  pub fn open(&mut self, conn: &mut Connection, id: &str, now: Now) -> Result<Exam> {
    self.0 = None;
    require_active(conn, id)?;
    let exam = self.save(conn, id, now)?;
    self.run(&exam, now);
    Ok(exam)
  }

  /// Saves the time so far, and ends the section if its time is up.
  pub fn save(&mut self, conn: &mut Connection, id: &str, now: Now) -> Result<Exam> {
    let tx = begin(conn)?;
    let kind = exam_config(&tx, id)?.kind;
    let mut counted = Duration::ZERO;
    let is_active = require_active(&tx, id).is_ok();
    let active = rows(&tx, id)?.into_iter().find(|row| row.status == SectionStatus::Active);
    if let Some(row) = active.filter(|_| is_active) {
      counted = self.since_saved(id, now);
      let steady = row.elapsed_ms + counted.as_millis() as i64;
      let elapsed = match (kind, row.started_ms) {
        // Wall time covers being closed or asleep. The steady clock covers the computer's
        // clock being set back, which would otherwise stop the timer.
        (ExamKind::FullSimulation, Some(started)) => (now.wall_ms - started).max(steady),
        _ => steady,
      };
      let elapsed = elapsed.min(row.time_limit_ms);
      tx.execute(
        "UPDATE exam_sections SET elapsed_ms = ?3 WHERE session_id = ?1 AND position = ?2",
        params![id, row.position, elapsed],
      )?;
      if elapsed >= row.time_limit_ms {
        let ended = match (kind, row.started_ms) {
          // The moment it ran out, so a break is not extended by being away.
          (ExamKind::FullSimulation, Some(started)) => {
            (started + row.time_limit_ms).min(now.wall_ms)
          }
          _ => now.wall_ms,
        };
        close(&tx, id, row.position, ended)?;
      }
    }
    let exam = view(&tx, id, now)?;
    tx.commit()?;
    // Only after saving: if it failed, this time is still counted at the next save.
    if let Some(running) = self.0.as_mut().filter(|running| running.session_id == id) {
      running.saved_until += Duration::from_millis(counted.as_millis() as u64);
    }
    if !matches!(exam.phase, Phase::Section { .. }) {
      self.stop(id);
    }
    Ok(exam)
  }

  /// The exam screen closed. Pauses a test; a simulation keeps running.
  pub fn leave(&mut self, conn: &mut Connection, id: &str, now: Now) -> Result<()> {
    let result = self.save(conn, id, now);
    self.stop(id);
    result.map(|_| ())
  }

  /// Saves and pauses whatever is running, such as when the app closes.
  pub fn leave_any(&mut self, conn: &mut Connection, now: Now) -> Result<()> {
    match self.0.as_ref().map(|running| running.session_id.clone()) {
      Some(id) => self.leave(conn, &id, now),
      None => Ok(()),
    }
  }

  pub fn start_section(&mut self, conn: &mut Connection, id: &str, now: Now) -> Result<Exam> {
    require_active(conn, id)?;
    let position = match self.save(conn, id, now)?.phase {
      Phase::Ready { position } => position,
      Phase::Break { next_position, can_skip: true, .. } => next_position,
      Phase::Break { .. } => return refused("The break has not ended yet."),
      Phase::Section { .. } => return refused("A section is already in progress."),
      Phase::Ended => return refused("This exam has ended."),
    };
    let tx = begin(conn)?;
    tx.execute(
      "UPDATE exam_sections SET status = 'active', started_ms = ?3, elapsed_ms = 0
       WHERE session_id = ?1 AND position = ?2 AND status = 'waiting'",
      params![id, position, now.wall_ms],
    )?;
    tx.execute(
      "UPDATE practice_sessions SET current_position =
         (SELECT min(display_order) FROM session_questions
          WHERE session_id = ?1 AND exam_section = ?2) WHERE id = ?1",
      params![id, position],
    )?;
    let exam = view(&tx, id, now)?;
    tx.commit()?;
    self.run(&exam, now);
    Ok(exam)
  }

  /// Ends the section early. `position` guards against ending the next one by mistake.
  pub fn end_section(
    &mut self,
    conn: &mut Connection,
    id: &str,
    position: i64,
    now: Now,
  ) -> Result<Exam> {
    let exam = self.save(conn, id, now)?;
    match exam.phase {
      Phase::Section { position: active, .. } if active == position => {}
      // It ran out just before, or was already ended.
      _ if exam.sections.iter().any(|section| {
        section.position == position && section.status == SectionStatus::Done
      }) =>
      {
        return Ok(exam);
      }
      _ => return refused("This section is not in progress."),
    }
    let tx = begin(conn)?;
    close(&tx, id, position, now.wall_ms)?;
    let exam = view(&tx, id, now)?;
    tx.commit()?;
    self.stop(id);
    Ok(exam)
  }

  /// Required before an answer changes.
  pub fn require_time(&mut self, conn: &mut Connection, question: &str, now: Now) -> Result<()> {
    let id = session_of(conn, question)?;
    require_active(conn, &id)?;
    let kind = exam_config(conn, &id)?.kind;
    let was_running = self.0.as_ref().is_some_and(|running| running.session_id == id);
    let exam = self.save(conn, &id, now)?;
    let in_section = exam.session.status == Status::InProgress
      && exam.session.questions.iter().any(|item| item.id == question);
    if !in_section || !matches!(exam.phase, Phase::Section { .. }) {
      return refused("This section has ended. Your saved answers were kept.");
    }
    if kind == ExamKind::Test && !was_running {
      return refused("The timer is paused. Leave this screen and resume the test.");
    }
    Ok(())
  }

  fn run(&mut self, exam: &Exam, now: Now) {
    if matches!(exam.phase, Phase::Section { .. }) {
      self.0 = Some(Running { session_id: exam.session.id.clone(), saved_until: now.instant });
    }
  }

  fn since_saved(&self, id: &str, now: Now) -> Duration {
    match &self.0 {
      Some(running) if running.session_id == id => {
        now.instant.saturating_duration_since(running.saved_until)
      }
      _ => Duration::ZERO,
    }
  }

  fn stop(&mut self, id: &str) {
    if self.0.as_ref().is_some_and(|running| running.session_id == id) {
      self.0 = None;
    }
  }
}
