//! The data in a practice session, and what the interface is allowed to see of it.

use rusqlite::{Row, types::Type};
use serde::{Deserialize, Serialize, de::DeserializeOwned};

use crate::import::package::{
  Explanations as ExplanationTexts, LABELS, Label, LabeledText, Passage, Question, Section,
};

#[derive(Serialize, Deserialize, Debug, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum Explanations {
  AfterEach,
  AtEnd,
}

#[derive(Serialize, Deserialize, Debug, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum Subset {
  Any,
  /// Never submitted.
  New,
  /// The most recent attempt was wrong.
  Missed,
  Bookmarked,
}

/// Choices that only custom sessions have.
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct Custom {
  pub lr_count: usize,
  pub subset: Subset,
  /// Leaves out questions whose most recent attempt was right.
  pub exclude_correct: bool,
  /// The interface uses this to order the questions it sends.
  pub shuffle_questions: bool,
  pub shuffle_answers: bool,
}

/// What is known about a question from earlier work.
#[derive(Debug, Clone, Copy)]
pub struct History {
  pub last_correct: Option<bool>,
  pub is_bookmarked: bool,
}

impl Custom {
  pub fn allows(&self, history: History) -> bool {
    let in_subset = match self.subset {
      Subset::Any => true,
      Subset::New => history.last_correct.is_none(),
      Subset::Missed => history.last_correct == Some(false),
      Subset::Bookmarked => history.is_bookmarked,
    };
    in_subset && !(self.exclude_correct && history.last_correct == Some(true))
  }
}

#[derive(Serialize, Deserialize, Debug, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ExamKind {
  /// Chosen sections. The clock pauses when the user leaves.
  Test,
  /// The full exam. The clock keeps running.
  FullSimulation,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct ExamConfig {
  pub kind: ExamKind,
  pub name: String,
}

/// The choices that created the session. Saved with it and never changed.
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct Config {
  /// Null for custom sessions, which can mix sections.
  pub section: Option<Section>,
  /// Empty means any. In a custom session, this applies within each section separately.
  pub category_ids: Vec<String>,
  /// Empty means any.
  pub difficulties: Vec<i64>,
  pub question_count: usize,
  pub explanations: Explanations,
  /// How many whole RC passage sets the session has.
  #[serde(default)]
  pub passage_count: Option<usize>,
  /// Null or missing means untimed.
  #[serde(default)]
  pub time_limit_seconds: Option<i64>,
  /// Null or missing means a targeted session.
  #[serde(default)]
  pub custom: Option<Custom>,
  /// Null or missing means practice.
  #[serde(default)]
  pub exam: Option<ExamConfig>,
}

impl Config {
  /// An exam's sections, with their own times, are stored separately.
  pub fn exam(exam: ExamConfig, question_count: usize) -> Self {
    Config {
      section: None,
      category_ids: vec![],
      difficulties: vec![],
      question_count,
      explanations: Explanations::AtEnd,
      passage_count: None,
      time_limit_seconds: None,
      custom: None,
      exam: Some(exam),
    }
  }

  pub fn session_type(&self) -> &'static str {
    match (&self.exam, &self.custom) {
      (Some(ExamConfig { kind: ExamKind::Test, .. }), _) => "test",
      (Some(ExamConfig { kind: ExamKind::FullSimulation, .. }), _) => "full_simulation",
      (None, Some(_)) => "custom",
      (None, None) => "targeted",
    }
  }

  /// Whether a question matches the given categories and the chosen difficulties.
  pub fn matches(&self, category_ids: &[&String], question: &Question) -> bool {
    (category_ids.is_empty() || category_ids.contains(&&question.primary_category))
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
  /// The original label shown in each position, A first. Attempts always store original
  /// choices, so shuffling never affects results or statistics.
  #[serde(default = "unshuffled")]
  pub choice_order: [Label; 5],
}

pub fn unshuffled() -> [Label; 5] {
  LABELS
}

impl Snapshot {
  /// The original choice behind a label on screen.
  pub fn original(&self, shown: Label) -> Label {
    self.choice_order[shown as usize]
  }

  /// The label on screen for an original choice.
  fn shown(&self, original: Label) -> Label {
    let position = self.choice_order.iter().position(|label| *label == original);
    position.map_or(original, |position| LABELS[position])
  }
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
  /// Position in the whole session.
  pub display_order: i64,
  /// Exams only.
  pub exam_section: Option<i64>,
  /// Null until an exam is completed, and outside exams.
  pub is_scored: Option<bool>,
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
    let is_submitted = is_correct.is_some();
    let selected = selected.and_then(|id| {
      let question_id = &snapshot.question.id;
      let is_selected = |label: &Label| id == format!("{question_id}:{}", label.as_str());
      LABELS.into_iter().find(is_selected).map(|original| snapshot.shown(original))
    });
    let correct_choice = snapshot.shown(snapshot.question.correct_choice);
    let choices = LABELS
      .into_iter()
      .map(|shown| {
        let original = snapshot.original(shown);
        let text = snapshot.question.choices.iter().find(|choice| choice.label == original);
        LabeledText { label: shown, text: text.map(|choice| choice.text.clone()).unwrap_or_default() }
      })
      .collect();
    let explanation =
      |shown: Label| snapshot.question.explanations.get(snapshot.original(shown)).to_owned();
    let outcome = (is_submitted || status == Status::Completed).then(|| Outcome {
      correct_choice,
      is_correct,
      explanations: ExplanationTexts {
        a: explanation(Label::A),
        b: explanation(Label::B),
        c: explanation(Label::C),
        d: explanation(Label::D),
        e: explanation(Label::E),
      },
    });
    let Snapshot { category_name, question, passage, .. } = snapshot;
    SessionQuestion {
      id,
      question_id: question.id,
      category_name,
      difficulty: question.difficulty,
      stimulus: question.stimulus,
      prompt: question.prompt,
      choices,
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
      display_order: 0,
      exam_section: None,
      is_scored: None,
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
