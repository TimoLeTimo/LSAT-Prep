//! Practice sessions. Every change is saved before the call returns, so closing the app
//! or a crash loses nothing that was confirmed.

mod clock;
mod letters;
mod model;
#[cfg(test)]
mod tests;

use std::{collections::BTreeSet, fmt};

use rusqlite::{Connection, OptionalExtension, Transaction, TransactionBehavior, params};

use crate::{
  db::DbError,
  import::{
    package::{Label, Question, Section},
    store,
  },
};
pub use clock::{Clock, Reading};
pub use model::*;

#[derive(Debug)]
pub enum PracticeError {
  /// Not allowed right now. Holds a plain-language reason.
  Refused(&'static str),
  Failed(DbError),
}

/// Messages are shown to the user.
impl fmt::Display for PracticeError {
  fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
    match self {
      PracticeError::Refused(reason) => f.write_str(reason),
      PracticeError::Failed(error) => write!(f, "Your work could not be saved. {error}"),
    }
  }
}

impl From<rusqlite::Error> for PracticeError {
  fn from(error: rusqlite::Error) -> Self {
    PracticeError::Failed(error.into())
  }
}

type Result<T> = std::result::Result<T, PracticeError>;

const NOT_FOUND: PracticeError = PracticeError::Refused("This practice session was not found.");
const ENDED: PracticeError = PracticeError::Refused("This practice session has ended.");
const LOCKED: PracticeError =
  PracticeError::Refused("This answer was already submitted, so it cannot be changed.");

const MAX_QUESTIONS: usize = 500;
const TIME_LIMIT_SECONDS: std::ops::RangeInclusive<i64> = 60..=6 * 60 * 60;
/// Longer gaps mean the computer slept or the app was left open.
const MAX_SECONDS_PER_SAVE: i64 = 600;

/// Takes the write lock first. Dropping the transaction without committing undoes it.
fn begin(conn: &mut Connection) -> rusqlite::Result<Transaction<'_>> {
  conn.transaction_with_behavior(TransactionBehavior::Immediate)
}

fn now(conn: &Connection) -> rusqlite::Result<String> {
  conn.query_row("SELECT strftime('%Y-%m-%dT%H:%M:%fZ', 'now')", [], |row| row.get(0))
}

fn new_id(conn: &Connection) -> rusqlite::Result<String> {
  conn.query_row("SELECT lower(hex(randomblob(16)))", [], |row| row.get(0))
}

fn choice_id(question_id: &str, label: Label) -> String {
  format!("{question_id}:{}", label.as_str())
}

// ---------------------------------------------------------------- Starting and resuming

/// Starts a session with these questions, in this order.
pub fn create(conn: &mut Connection, config: &Config, question_ids: &[String]) -> Result<Session> {
  if question_ids.is_empty() || question_ids.len() > MAX_QUESTIONS {
    return Err(PracticeError::Refused("Choose between 1 and 500 questions."));
  }
  if question_ids.len() != config.question_count {
    return Err(PracticeError::Refused("The number of questions does not match the session."));
  }
  if question_ids.iter().collect::<BTreeSet<_>>().len() != question_ids.len() {
    return Err(PracticeError::Refused("A question cannot appear twice in a session."));
  }

  if config.time_limit_seconds.is_some_and(|limit| !TIME_LIMIT_SECONDS.contains(&limit)) {
    return Err(PracticeError::Refused("Choose a time limit from 1 to 360 minutes."));
  }

  let tx = begin(conn)?;
  if unfinished_id(&tx, config.section)?.is_some() {
    return Err(PracticeError::Refused("Finish or end your current session first."));
  }
  let id = new_id(&tx)?;
  let time = now(&tx)?;
  tx.execute(
    "INSERT INTO practice_sessions (id, session_type, configuration_json, status, started_at,
       created_at, time_limit_seconds) VALUES (?1, ?5, ?2, 'in_progress', ?3, ?3, ?4)",
    params![
      id,
      to_json(config)?,
      time,
      config.time_limit_seconds,
      if config.custom.is_some() { "custom" } else { "targeted" }
    ],
  )?;
  let mut snapshots = question_ids
    .iter()
    .map(|question_id| take_snapshot(&tx, question_id))
    .collect::<Result<Vec<_>>>()?;
  check_fit(&tx, config, &snapshots)?;
  if config.custom.as_ref().is_some_and(|custom| custom.shuffle_answers) {
    for snapshot in &mut snapshots {
      if !letters::mentions_choices(&snapshot.question) {
        snapshot.choice_order = random_order(&tx)?;
      }
    }
  }
  for (position, (question_id, snapshot)) in question_ids.iter().zip(&snapshots).enumerate() {
    tx.prepare_cached(
      "INSERT INTO session_questions (id, session_id, question_id, display_order,
         content_snapshot_json) VALUES (?1, ?2, ?3, ?4, ?5)",
    )?
    .execute(params![new_id(&tx)?, id, question_id, position as i64, to_json(snapshot)?])?;
  }
  let session = load(&tx, &id)?;
  tx.commit()?;
  Ok(session)
}

const UNAVAILABLE: PracticeError =
  PracticeError::Refused("A chosen question is no longer available. Start again.");

/// A full copy of the question, if it can be practiced.
fn take_snapshot(conn: &Connection, id: &str) -> Result<Snapshot> {
  let available: Option<String> = conn
    .prepare_cached(
      "SELECT c.name FROM questions q
       JOIN question_categories c ON c.id = q.category_id
       LEFT JOIN passages p ON p.id = q.passage_id
       WHERE q.id = ?1 AND q.status = 'approved' AND c.active = 1
         AND (q.passage_id IS NULL OR p.status = 'approved')",
    )?
    .query_row([id], |row| row.get(0))
    .optional()?;
  let category_name = available.ok_or(UNAVAILABLE)?;
  let question = store::load_question(conn, id)?.ok_or(UNAVAILABLE)?;
  let passage = match &question.passage_id {
    Some(passage_id) => Some(store::load_passage(conn, passage_id)?.ok_or(UNAVAILABLE)?),
    None => None,
  };
  let choice_order = unshuffled();
  Ok(Snapshot { snapshot_version: 1, category_name, question, passage, choice_order })
}

const MISFIT: PracticeError = PracticeError::Refused("A chosen question does not fit this session.");

fn check_fit(conn: &Connection, config: &Config, snapshots: &[Snapshot]) -> Result<()> {
  // LR questions come first, then passages.
  let is_lr = |snapshot: &Snapshot| snapshot.question.section == Section::LogicalReasoning;
  let lr_count = snapshots.iter().take_while(|snapshot| is_lr(snapshot)).count();
  let (lr, rc) = snapshots.split_at(lr_count);
  if rc.iter().any(is_lr) {
    return Err(MISFIT);
  }
  let expected = match (&config.custom, config.section, config.passage_count) {
    (None, Some(Section::LogicalReasoning), None) => (snapshots.len(), 0),
    (None, Some(Section::ReadingComprehension), Some(passages)) => (0, passages),
    (Some(custom), None, passages) => (custom.lr_count, passages.unwrap_or(0)),
    _ => return Err(MISFIT),
  };
  if lr.len() != expected.0 {
    return Err(MISFIT);
  }
  for snapshot in lr {
    if !qualifies(conn, config, &snapshot.question)? {
      return Err(MISFIT);
    }
  }
  check_passage_sets(conn, config, rc, expected.1)
}

/// Whether a question matches the filters and, in a custom session, the earlier work.
fn qualifies(conn: &Connection, config: &Config, question: &Question) -> Result<bool> {
  let mut categories = Vec::new();
  for id in &config.category_ids {
    let category = store::load_category(conn, id)?
      .ok_or(PracticeError::Refused("A chosen category was not found."))?;
    if config.custom.is_none() || category.section == question.section {
      categories.push(id);
    }
  }
  if !config.matches(&categories, question) {
    return Ok(false);
  }
  match &config.custom {
    Some(custom) => Ok(custom.allows(history(conn, &question.id)?)),
    None => Ok(true),
  }
}

fn history(conn: &Connection, question_id: &str) -> rusqlite::Result<History> {
  conn
    .prepare_cached(
      "SELECT
         (SELECT is_correct FROM attempts WHERE question_id = ?1
          ORDER BY attempted_at DESC, rowid DESC LIMIT 1),
         EXISTS (SELECT 1 FROM bookmarks WHERE question_id = ?1)",
    )?
    .query_row([question_id], |row| {
      Ok(History { last_correct: row.get(0)?, is_bookmarked: row.get(1)? })
    })
}

/// Each passage must appear once, with all of its available questions, in order. At least
/// one of them must match the filters.
fn check_passage_sets(
  conn: &Connection,
  config: &Config,
  snapshots: &[Snapshot],
  count: usize,
) -> Result<()> {
  let sets: Vec<_> = snapshots
    .chunk_by(|a, b| a.question.passage_id == b.question.passage_id)
    .collect();
  let passages: BTreeSet<_> = sets.iter().map(|set| &set[0].question.passage_id).collect();
  if sets.len() != count || passages.len() != count {
    return Err(PracticeError::Refused("The passages do not match the session."));
  }
  for set in sets {
    let available = conn
      .prepare_cached(
        "SELECT q.id FROM questions q JOIN question_categories c ON c.id = q.category_id
         WHERE q.passage_id = ?1 AND q.status = 'approved' AND c.active = 1 ORDER BY q.rowid",
      )?
      .query_map([&set[0].question.passage_id], |row| row.get(0))?
      .collect::<rusqlite::Result<Vec<String>>>()?;
    if !set.iter().map(|snapshot| &snapshot.question.id).eq(&available) {
      return Err(PracticeError::Refused(
        "A passage must keep all of its questions, in order. Start again.",
      ));
    }
    let mut any = false;
    for snapshot in set {
      any = any || qualifies(conn, config, &snapshot.question)?;
    }
    if !any {
      return Err(PracticeError::Refused("A chosen passage does not fit this session."));
    }
  }
  Ok(())
}

/// Fisher–Yates shuffle, with randomness from SQLite.
fn random_order(conn: &Connection) -> rusqlite::Result<[Label; 5]> {
  let mut order = unshuffled();
  for last in (1..order.len()).rev() {
    let other: i64 =
      conn.query_row("SELECT (random() & 0x7fffffffffff) % ?1", [last as i64 + 1], |row| row.get(0))?;
    order.swap(last, other as usize);
  }
  Ok(order)
}

/// With no section, finds a custom session.
fn unfinished_id(conn: &Connection, section: Option<Section>) -> rusqlite::Result<Option<String>> {
  conn
    .query_row(
      "SELECT id FROM practice_sessions
       WHERE status = 'in_progress'
         AND session_type = CASE WHEN ?1 IS NULL THEN 'custom' ELSE 'targeted' END
         AND configuration_json ->> 'section' IS ?1
       ORDER BY created_at DESC LIMIT 1",
      [section.map(Section::as_str)],
      |row| row.get(0),
    )
    .optional()
}

/// The session to resume, if there is one. With no section, finds a custom session.
pub fn unfinished(conn: &Connection, section: Option<Section>) -> Result<Option<Session>> {
  unfinished_id(conn, section)?.map(|id| load(conn, &id)).transpose()
}

/// Answers and explanations are included only for questions whose result may be shown.
pub fn load(conn: &Connection, id: &str) -> Result<Session> {
  let (config, status, current_position, active_ms, created_at, completed_at) = conn
    .query_row(
      "SELECT configuration_json, status, current_position, active_ms, created_at,
         completed_at
       FROM practice_sessions WHERE id = ?1",
      [id],
      |row| {
        let (config, status) = (from_json(row, 0)?, from_text(row, 1)?);
        Ok((config, status, row.get(2)?, row.get(3)?, row.get(4)?, row.get(5)?))
      },
    )
    .optional()?
    .ok_or(NOT_FOUND)?;
  let questions = conn
    .prepare_cached(
      "SELECT s.id, s.content_snapshot_json, s.selected_choice_id, s.is_flagged,
         s.time_spent_seconds, a.is_correct,
         EXISTS (SELECT 1 FROM bookmarks b WHERE b.question_id = s.question_id)
       FROM session_questions s LEFT JOIN attempts a ON a.session_question_id = s.id
       WHERE s.session_id = ?1 ORDER BY s.display_order",
    )?
    .query_map([id], |row| {
      let snapshot: Snapshot = from_json(row, 1)?;
      let selected: Option<String> = row.get(2)?;
      Ok(SessionQuestion::new(
        row.get(0)?,
        snapshot,
        selected,
        row.get(3)?,
        row.get(4)?,
        row.get(5)?,
        row.get(6)?,
        status,
      ))
    })?
    .collect::<rusqlite::Result<_>>()?;
  Ok(Session {
    id: id.into(),
    config,
    status,
    current_position,
    active_ms,
    created_at,
    completed_at,
    questions,
  })
}

// ---------------------------------------------------------------- Changing a session

struct Stored {
  session_id: String,
  question_id: String,
  config: Config,
  selected: Option<String>,
  submitted: bool,
}

/// Finds a question in a session that is still in progress.
fn active_question(conn: &Connection, id: &str) -> Result<Stored> {
  let (stored, status): (Stored, Status) = conn
    .query_row(
      "SELECT s.session_id, s.question_id, p.configuration_json, s.selected_choice_id,
         EXISTS (SELECT 1 FROM attempts a WHERE a.session_question_id = s.id), p.status
       FROM session_questions s JOIN practice_sessions p ON p.id = s.session_id WHERE s.id = ?1",
      [id],
      |row| {
        let stored = Stored {
          session_id: row.get(0)?,
          question_id: row.get(1)?,
          config: from_json(row, 2)?,
          selected: row.get(3)?,
          submitted: row.get(4)?,
        };
        Ok((stored, from_text(row, 5)?))
      },
    )
    .optional()?
    .ok_or(NOT_FOUND)?;
  if status == Status::InProgress { Ok(stored) } else { Err(ENDED) }
}

fn require_active(conn: &Connection, session_id: &str) -> Result<()> {
  let status: Status = conn
    .query_row("SELECT status FROM practice_sessions WHERE id = ?1", [session_id], |row| {
      from_text(row, 0)
    })
    .optional()?
    .ok_or(NOT_FOUND)?;
  if status == Status::InProgress { Ok(()) } else { Err(ENDED) }
}

/// The session that a session question belongs to.
pub fn session_of(conn: &Connection, id: &str) -> Result<String> {
  conn
    .query_row("SELECT session_id FROM session_questions WHERE id = ?1", [id], |row| row.get(0))
    .optional()?
    .ok_or(NOT_FOUND)
}

/// Saves a selection, or clears it. Not an attempt until it is submitted.
pub fn select(conn: &mut Connection, id: &str, choice: Option<Label>) -> Result<()> {
  let tx = begin(conn)?;
  let question = active_question(&tx, id)?;
  if question.submitted {
    return Err(LOCKED);
  }
  let snapshot = load_snapshot(&tx, id)?;
  let selected =
    choice.map(|shown| choice_id(&question.question_id, snapshot.original(shown)));
  let time = now(&tx)?;
  tx.execute(
    "UPDATE session_questions SET selected_choice_id = ?2,
       answered_at = CASE WHEN ?2 IS NULL THEN NULL ELSE ?3 END WHERE id = ?1",
    params![id, selected, time],
  )?;
  Ok(tx.commit()?)
}

/// Bookmarks belong to the question, not the session, so they can change at any time and
/// remain afterward. Repeating a change has no effect.
pub fn set_bookmark(conn: &mut Connection, question_id: &str, bookmarked: bool) -> Result<()> {
  let tx = begin(conn)?;
  let exists: bool = tx.query_row(
    "SELECT EXISTS (SELECT 1 FROM questions WHERE id = ?1)",
    [question_id],
    |row| row.get(0),
  )?;
  if !exists {
    return Err(PracticeError::Refused("This question was not found."));
  }
  if bookmarked {
    tx.execute(
      "INSERT INTO bookmarks (id, question_id, created_at) VALUES (?1, ?2, ?3)
       ON CONFLICT (question_id) DO NOTHING",
      params![new_id(&tx)?, question_id, now(&tx)?],
    )?;
  } else {
    tx.execute("DELETE FROM bookmarks WHERE question_id = ?1", [question_id])?;
  }
  Ok(tx.commit()?)
}

pub fn set_flag(conn: &mut Connection, id: &str, flagged: bool) -> Result<()> {
  let tx = begin(conn)?;
  active_question(&tx, id)?;
  tx.execute("UPDATE session_questions SET is_flagged = ?2 WHERE id = ?1", params![id, flagged])?;
  Ok(tx.commit()?)
}

/// Adds time spent on a question that has not been submitted.
pub fn add_time(conn: &mut Connection, id: &str, seconds: i64) -> Result<()> {
  if !(0..=MAX_SECONDS_PER_SAVE).contains(&seconds) {
    return Err(PracticeError::Refused("This amount of time is not valid."));
  }
  let tx = begin(conn)?;
  if active_question(&tx, id)?.submitted {
    return Err(LOCKED);
  }
  tx.execute(
    "UPDATE session_questions SET time_spent_seconds = time_spent_seconds + ?2 WHERE id = ?1",
    params![id, seconds],
  )?;
  Ok(tx.commit()?)
}

pub fn set_position(conn: &mut Connection, session_id: &str, position: i64) -> Result<()> {
  let tx = begin(conn)?;
  require_active(&tx, session_id)?;
  let changed = tx.execute(
    "UPDATE practice_sessions SET current_position = ?2 WHERE id = ?1 AND EXISTS
       (SELECT 1 FROM session_questions WHERE session_id = ?1 AND display_order = ?2)",
    params![session_id, position],
  )?;
  if changed == 0 {
    return Err(PracticeError::Refused("This question is not in the session."));
  }
  Ok(tx.commit()?)
}

/// Check Answer: submits one answer and locks it. Repeating it changes nothing.
pub fn submit(conn: &mut Connection, id: &str) -> Result<Session> {
  let tx = begin(conn)?;
  let question = active_question(&tx, id)?;
  if question.config.explanations != Explanations::AfterEach {
    return Err(PracticeError::Refused("Answers in this session are submitted when you finish."));
  }
  if !question.submitted {
    if question.selected.is_none() {
      return Err(PracticeError::Refused("Choose an answer first."));
    }
    record_attempt(&tx, id)?;
  }
  let session = load(&tx, &question.session_id)?;
  tx.commit()?;
  Ok(session)
}

/// Ends the session and submits every selected answer. Unanswered questions get no attempt.
pub fn finish(conn: &mut Connection, session_id: &str) -> Result<Session> {
  let tx = begin(conn)?;
  let session = finish_in(&tx, session_id)?;
  tx.commit()?;
  Ok(session)
}

fn finish_in(tx: &Connection, session_id: &str) -> Result<Session> {
  require_active(tx, session_id)?;
  let waiting = tx
    .prepare(
      "SELECT id FROM session_questions s WHERE session_id = ?1 AND selected_choice_id IS NOT NULL
         AND NOT EXISTS (SELECT 1 FROM attempts a WHERE a.session_question_id = s.id)",
    )?
    .query_map([session_id], |row| row.get(0))?
    .collect::<rusqlite::Result<Vec<String>>>()?;
  for id in waiting {
    record_attempt(tx, &id)?;
  }
  end(tx, session_id, "completed")?;
  load(tx, session_id)
}

/// Ends the session without submitting anything more. Submitted answers are kept.
pub fn abandon(conn: &mut Connection, session_id: &str) -> Result<()> {
  let tx = begin(conn)?;
  require_active(&tx, session_id)?;
  end(&tx, session_id, "abandoned")?;
  Ok(tx.commit()?)
}

fn end(conn: &Connection, session_id: &str, status: &str) -> rusqlite::Result<()> {
  conn.execute(
    "UPDATE practice_sessions SET status = ?2,
       completed_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?1",
    [session_id, status],
  )?;
  Ok(())
}

fn load_snapshot(conn: &Connection, id: &str) -> rusqlite::Result<Snapshot> {
  conn.query_row(
    "SELECT content_snapshot_json FROM session_questions WHERE id = ?1",
    [id],
    |row| from_json(row, 0),
  )
}

/// Marks the answer against the saved copy, which is what the user saw.
fn record_attempt(conn: &Connection, id: &str) -> Result<()> {
  let snapshot = load_snapshot(conn, id)?;
  conn.execute(
    "INSERT INTO attempts (id, session_question_id, session_id, question_id, selected_choice_id,
       is_correct, time_spent_seconds, attempted_at, attempt_kind)
     SELECT ?2, id, session_id, question_id, selected_choice_id, selected_choice_id = ?3,
       time_spent_seconds, ?4, 'original' FROM session_questions WHERE id = ?1",
    params![
      id,
      new_id(conn)?,
      choice_id(&snapshot.question.id, snapshot.question.correct_choice),
      now(conn)?
    ],
  )?;
  Ok(())
}
