//! The data in a practice session, and what the interface is allowed to see of it.

use rusqlite::{Row, types::Type};
use serde::{Deserialize, Serialize, de::DeserializeOwned};

use crate::import::package::{Explanations as ExplanationTexts, Label, LabeledText, Passage, Question, Section};

#[derive(Serialize, Deserialize, Debug, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum Explanations {
  AfterEach,
  AtEnd,
}

/// The choices that created the session. Saved with it and never changed.
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct Config {
  pub section: Section,
  /// Empty means any.
  pub category_ids: Vec<String>,
  /// Empty means any.
  pub difficulties: Vec<i64>,
  pub question_count: usize,
  pub explanations: Explanations,
  /// RC only: how many whole passage sets the session has.
  #[serde(default)]
  pub passage_count: Option<usize>,
  /// Null or missing means untimed.
  #[serde(default)]
  pub time_limit_seconds: Option<i64>,
}

impl Config {
  /// Whether a question matches the chosen categories and difficulties.
  pub fn matches(&self, question: &Question) -> bool {
    (self.category_ids.is_empty() || self.category_ids.contains(&question.primary_category))
      && (self.difficulties.is_empty() || self.difficulties.contains(&question.difficulty))
  }
}

#[derive(Serialize, Deserialize, Debug, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum Status {
  InProgress,
  Completed,
  Abandoned,
}

/// Everything shown for one question, kept exactly as it was.
#[derive(Serialize, Deserialize, Debug, PartialEq)]
pub struct Snapshot {
  pub snapshot_version: i64,
  pub category_name: String,
  pub question: Question,
  pub passage: Option<Passage>,
}

#[derive(Serialize, Debug, PartialEq)]
pub struct PassageView {
  id: String,
  title: String,
  texts: Vec<LabeledText>,
}

#[derive(Serialize, Debug, PartialEq)]
pub struct Outcome {
  pub correct_choice: Label,
  /// Null when the question was not answered.
  pub is_correct: Option<bool>,
  pub explanations: ExplanationTexts,
}

#[derive(Serialize, Debug, PartialEq)]
pub struct SessionQuestion {
  pub id: String,
  pub question_id: String,
  pub category_name: String,
  pub difficulty: i64,
  pub stimulus: Option<String>,
  pub prompt: String,
  pub choices: Vec<LabeledText>,
  pub passage: Option<PassageView>,
  pub selected: Option<Label>,
  /// Lasts only for this session.
  pub is_flagged: bool,
  /// Stays with the question after the session.
  pub is_bookmarked: bool,
  pub time_spent_seconds: i64,
  pub is_submitted: bool,
  /// Null until the answer is submitted or the session is completed.
  pub outcome: Option<Outcome>,
}

impl SessionQuestion {
  #[expect(clippy::too_many_arguments, reason = "one argument for each stored value")]
  pub fn new(
    id: String,
    snapshot: Snapshot,
    selected: Option<String>,
    is_flagged: bool,
    time_spent_seconds: i64,
    is_correct: Option<bool>,
    is_bookmarked: bool,
    status: Status,
  ) -> Self {
    let Snapshot { category_name, question, passage, .. } = snapshot;
    let is_submitted = is_correct.is_some();
    let outcome = (is_submitted || status == Status::Completed).then_some(Outcome {
      correct_choice: question.correct_choice,
      is_correct,
      explanations: question.explanations,
    });
    let selected = selected.and_then(|id| {
      let is_selected = |label: &Label| id == format!("{}:{}", question.id, label.as_str());
      question.choices.iter().map(|choice| choice.label).find(is_selected)
    });
    SessionQuestion {
      id,
      question_id: question.id,
      category_name,
      difficulty: question.difficulty,
      stimulus: question.stimulus,
      prompt: question.prompt,
      choices: question.choices,
      passage: passage.map(|passage| PassageView {
        id: passage.id,
        title: passage.title,
        texts: passage.texts,
      }),
      selected,
      is_flagged,
      is_bookmarked,
      time_spent_seconds,
      is_submitted,
      outcome,
    }
  }
}

#[derive(Serialize, Debug, PartialEq)]
pub struct Session {
  pub id: String,
  pub config: Config,
  pub status: Status,
  pub current_position: i64,
  /// Time the clock has run, as of the last save.
  pub active_ms: i64,
  pub created_at: String,
  pub completed_at: Option<String>,
  pub questions: Vec<SessionQuestion>,
}

pub fn to_json<T: Serialize>(value: &T) -> rusqlite::Result<String> {
  serde_json::to_string(value)
    .map_err(|error| rusqlite::Error::ToSqlConversionFailure(Box::new(error)))
}

pub fn from_json<T: DeserializeOwned>(row: &Row, index: usize) -> rusqlite::Result<T> {
  convert(index, serde_json::from_str(&row.get::<_, String>(index)?))
}

/// Reads a stored word, such as "in_progress".
pub fn from_text<T: DeserializeOwned>(row: &Row, index: usize) -> rusqlite::Result<T> {
  convert(index, serde_json::from_value(serde_json::Value::String(row.get(index)?)))
}

fn convert<T>(index: usize, result: serde_json::Result<T>) -> rusqlite::Result<T> {
  result
    .map_err(|error| rusqlite::Error::FromSqlConversionFailure(index, Type::Text, Box::new(error)))
}
