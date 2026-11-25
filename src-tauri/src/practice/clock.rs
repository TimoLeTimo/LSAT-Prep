//! The session clock. It runs only while the practice screen is open, and stops while the
//! computer sleeps because `Instant` does not advance then. Time is added to the database
//! at each save, so an abrupt quit loses only what came after the last one.

use std::time::{Duration, Instant};

use rusqlite::{Connection, params};
use serde::Serialize;

use super::{PracticeError, Result, Session, Status, begin, finish_in, load, require_active};

struct Running {
  session_id: String,
  saved_until: Instant,
}

#[derive(Default)]
pub struct Clock(Option<Running>);

#[derive(Serialize, Debug, PartialEq)]
pub struct Reading {
  /// Null when the session has no time limit.
  pub remaining_ms: Option<i64>,
  /// The final session, once it has ended.
  pub ended: Option<Session>,
}

pub const PAUSED: PracticeError =
  PracticeError::Refused("The timer is paused. Leave this screen and resume the session.");
pub const TIME_UP: PracticeError =
  PracticeError::Refused("Time is up. Your saved answers were submitted.");

impl Clock {
  /// Starts or resumes. Anything after the last save is dropped, as if the app had closed.
  pub fn start(&mut self, conn: &mut Connection, id: &str, now: Instant) -> Result<Reading> {
    self.0 = None;
    require_active(conn, id)?;
    self.0 = Some(Running { session_id: id.into(), saved_until: now });
    self.save(conn, id, now)
  }

  /// Saves the time so far. At the limit, submits the saved answers and ends the session,
  /// in the same transaction.
  pub fn save(&mut self, conn: &mut Connection, id: &str, now: Instant) -> Result<Reading> {
    let tx = begin(conn)?;
    let session = load(&tx, id)?;
    if session.status != Status::InProgress {
      self.stop(id);
      return Ok(Reading { remaining_ms: None, ended: Some(session) });
    }
    if session.config.exam.is_some() {
      return Err(PracticeError::Refused("An exam has its own timer."));
    }
    let elapsed = match &self.0 {
      Some(running) if running.session_id == id => now.saturating_duration_since(running.saved_until),
      _ => Duration::ZERO,
    };
    let total = session.active_ms + elapsed.as_millis() as i64;
    let limit = session.config.time_limit_seconds.map(|seconds| seconds * 1000);
    let active = limit.map_or(total, |limit| total.min(limit));
    tx.execute("UPDATE practice_sessions SET active_ms = ?2 WHERE id = ?1", params![id, active])?;

    let remaining_ms = limit.map(|limit| limit - active);
    let ended = if remaining_ms == Some(0) { Some(finish_in(&tx, id)?) } else { None };
    tx.commit()?;
    // Only after saving: if it failed, this time is still counted at the next save.
    if ended.is_some() {
      self.stop(id);
    } else if let Some(running) = self.0.as_mut().filter(|running| running.session_id == id) {
      running.saved_until += Duration::from_millis(elapsed.as_millis() as u64);
    }
    Ok(Reading { remaining_ms, ended })
  }

  pub fn pause(&mut self, conn: &mut Connection, id: &str, now: Instant) -> Result<Reading> {
    let reading = self.save(conn, id, now);
    self.stop(id);
    reading
  }

  /// Saves and stops whatever is running, such as when the app closes.
  pub fn pause_any(&mut self, conn: &mut Connection, now: Instant) -> Result<()> {
    if let Some(id) = self.0.as_ref().map(|running| running.session_id.clone()) {
      self.pause(conn, &id, now)?;
    }
    Ok(())
  }

  /// Required before an answer changes. Untimed sessions do not need a running clock.
  pub fn require_time(&mut self, conn: &mut Connection, id: &str, now: Instant) -> Result<()> {
    require_active(conn, id)?;
    let is_running = self.0.as_ref().is_some_and(|running| running.session_id == id);
    let reading = self.save(conn, id, now)?;
    if reading.ended.is_some() {
      return Err(TIME_UP);
    }
    if reading.remaining_ms.is_some() && !is_running {
      return Err(PAUSED);
    }
    Ok(())
  }

  fn stop(&mut self, id: &str) {
    if self.0.as_ref().is_some_and(|running| running.session_id == id) {
      self.0 = None;
    }
  }
}
