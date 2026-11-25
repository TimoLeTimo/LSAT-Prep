//! The records that Review and Statistics are calculated from. Details of each answer come
//! from the saved copy of the question, so they describe what was actually answered.

use rusqlite::Connection;
use serde::Serialize;

use crate::practice::{self, PracticeError, SessionQuestion};

#[derive(Serialize, Debug, PartialEq)]
pub struct AnswerRecord {
  pub question_id: String,
  pub section: String,
  pub category_id: String,
  pub category_name: String,
  pub difficulty: i64,
  pub is_correct: bool,
  pub seconds: i64,
  pub answered_at: String,
  pub is_retry: bool,
}

#[derive(Serialize, Debug, PartialEq)]
pub struct SessionRecord {
  pub id: String,
  pub session_type: String,
  /// Null for sessions that mix sections.
  pub section: Option<String>,
  /// Exams only.
  pub name: Option<String>,
  pub status: String,
  pub started_at: String,
  pub completed_at: Option<String>,
  /// Clock time, without pauses or breaks.
  pub practice_ms: i64,
  pub questions: i64,
  pub answered: i64,
  pub correct: i64,
  /// Counted toward an exam's raw score. The same as above outside exams.
  pub scored_questions: i64,
  pub scored_correct: i64,
}

#[derive(Serialize, Debug, PartialEq)]
pub struct Records {
  pub answers: Vec<AnswerRecord>,
  pub sessions: Vec<SessionRecord>,
}

/// In order of time.
pub fn records(conn: &Connection) -> rusqlite::Result<Records> {
  let answers = conn
    .prepare(
      "SELECT a.question_id, s.content_snapshot_json ->> '$.question.section',
         s.content_snapshot_json ->> '$.question.primary_category',
         s.content_snapshot_json ->> '$.category_name',
         s.content_snapshot_json ->> '$.question.difficulty',
         a.is_correct, coalesce(a.time_spent_seconds, 0), a.attempted_at,
         a.attempt_kind <> 'original'
       FROM attempts a JOIN session_questions s ON s.id = a.session_question_id
       ORDER BY a.attempted_at, a.rowid",
    )?
    .query_map([], |row| {
      Ok(AnswerRecord {
        question_id: row.get(0)?,
        section: row.get(1)?,
        category_id: row.get(2)?,
        category_name: row.get(3)?,
        difficulty: row.get(4)?,
        is_correct: row.get(5)?,
        seconds: row.get(6)?,
        answered_at: row.get(7)?,
        is_retry: row.get(8)?,
      })
    })?
    .collect::<rusqlite::Result<_>>()?;
  // What is unscored in an unfinished exam stays hidden.
  let sessions = conn
    .prepare(
      "SELECT p.id, p.session_type, p.configuration_json ->> '$.section',
         p.configuration_json ->> '$.exam.name', p.status, coalesce(p.started_at, p.created_at),
         p.completed_at,
         p.active_ms + coalesce((SELECT sum(elapsed_ms) FROM exam_sections e
           WHERE e.session_id = p.id), 0),
         count(s.id), count(a.id), coalesce(sum(a.is_correct), 0),
         CASE WHEN p.status = 'completed' THEN coalesce(sum(s.is_scored), 0) ELSE count(s.id) END,
         CASE WHEN p.status = 'completed' THEN coalesce(sum(a.is_correct AND s.is_scored), 0)
           ELSE coalesce(sum(a.is_correct), 0) END
       FROM practice_sessions p
       LEFT JOIN session_questions s ON s.session_id = p.id
       LEFT JOIN attempts a ON a.session_question_id = s.id
       GROUP BY p.id ORDER BY p.created_at, p.rowid",
    )?
    .query_map([], |row| {
      Ok(SessionRecord {
        id: row.get(0)?,
        session_type: row.get(1)?,
        section: row.get(2)?,
        name: row.get(3)?,
        status: row.get(4)?,
        started_at: row.get(5)?,
        completed_at: row.get(6)?,
        practice_ms: row.get(7)?,
        questions: row.get(8)?,
        answered: row.get(9)?,
        correct: row.get(10)?,
        scored_questions: row.get(11)?,
        scored_correct: row.get(12)?,
      })
    })?
    .collect::<rusqlite::Result<_>>()?;
  Ok(Records { answers, sessions })
}

#[derive(Serialize, Debug, PartialEq)]
pub struct ReviewItem {
  pub question_id: String,
  pub section: String,
  pub category_name: String,
  pub difficulty: i64,
  pub passage_id: Option<String>,
  /// The start of the question, to recognize it by.
  pub excerpt: String,
  pub times_answered: i64,
  /// The most recent answer, or null if never submitted.
  pub last_correct: Option<bool>,
  pub last_answered_at: Option<String>,
  pub is_bookmarked: bool,
  /// Whether it can be tried again. Retired questions cannot.
  pub can_retry: bool,
}

/// Every question that was answered or bookmarked, in the question bank's order.
pub fn review_items(conn: &Connection) -> rusqlite::Result<Vec<ReviewItem>> {
  conn
    .prepare(
      "SELECT q.id, q.section, c.name, q.difficulty, q.passage_id,
         substr(coalesce(q.stimulus, q.prompt), 1, 160),
         (SELECT count(*) FROM attempts a WHERE a.question_id = q.id),
         (SELECT is_correct FROM attempts a WHERE a.question_id = q.id
          ORDER BY attempted_at DESC, rowid DESC LIMIT 1),
         (SELECT max(attempted_at) FROM attempts a WHERE a.question_id = q.id),
         EXISTS (SELECT 1 FROM bookmarks b WHERE b.question_id = q.id),
         q.status = 'approved' AND c.active = 1 AND (p.id IS NULL OR p.status = 'approved')
       FROM questions q
       JOIN question_categories c ON c.id = q.category_id
       LEFT JOIN passages p ON p.id = q.passage_id
       WHERE EXISTS (SELECT 1 FROM attempts a WHERE a.question_id = q.id)
         OR EXISTS (SELECT 1 FROM bookmarks b WHERE b.question_id = q.id)
       ORDER BY q.rowid",
    )?
    .query_map([], |row| {
      Ok(ReviewItem {
        question_id: row.get(0)?,
        section: row.get(1)?,
        category_name: row.get(2)?,
        difficulty: row.get(3)?,
        passage_id: row.get(4)?,
        excerpt: row.get(5)?,
        times_answered: row.get(6)?,
        last_correct: row.get(7)?,
        last_answered_at: row.get(8)?,
        is_bookmarked: row.get(9)?,
        can_retry: row.get(10)?,
      })
    })?
    .collect()
}

#[derive(Serialize, Debug, PartialEq)]
pub struct PastAnswer {
  pub answered_at: String,
  pub session_type: String,
  pub is_retry: bool,
  /// Exactly as it was shown, with the answer given.
  pub question: SessionQuestion,
}

/// Every submitted answer to a question, newest first.
pub fn question_history(
  conn: &Connection,
  question_id: &str,
) -> Result<Vec<PastAnswer>, PracticeError> {
  let found = conn
    .prepare(
      "SELECT a.session_id, a.session_question_id, a.attempted_at, p.session_type,
         a.attempt_kind <> 'original'
       FROM attempts a JOIN practice_sessions p ON p.id = a.session_id
       WHERE a.question_id = ?1 ORDER BY a.attempted_at DESC, a.rowid DESC",
    )?
    .query_map([question_id], |row| {
      Ok((
        row.get::<_, String>(0)?,
        row.get::<_, String>(1)?,
        row.get::<_, String>(2)?,
        row.get::<_, String>(3)?,
        row.get::<_, bool>(4)?,
      ))
    })?
    .collect::<rusqlite::Result<Vec<_>>>()?;
  let mut history = Vec::new();
  for (session_id, id, answered_at, session_type, is_retry) in found {
    let session = practice::load(conn, &session_id)?;
    if let Some(question) = session.questions.into_iter().find(|question| question.id == id) {
      history.push(PastAnswer { answered_at, session_type, is_retry, question });
    }
  }
  Ok(history)
}

#[cfg(test)]
mod tests;
