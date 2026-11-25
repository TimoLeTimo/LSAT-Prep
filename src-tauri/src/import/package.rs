//! The package file, read strictly. Unknown fields, repeated fields, and unapproved
//! content cannot be represented by these types, so they fail to load.
//! Detailed, user-friendly checks are in src/domain/content/validatePackage.ts.

use std::collections::BTreeSet;

use serde::{Deserialize, Serialize};

pub const MAX_BYTES: usize = 20 * 1024 * 1024;
pub const LABELS: [Label; 5] = [Label::A, Label::B, Label::C, Label::D, Label::E];

#[derive(Deserialize, Debug)]
#[serde(deny_unknown_fields)]
pub struct Package {
  #[expect(dead_code, reason = "only its value is checked")]
  format: Format,
  pub schema_version: i64,
  pub package_id: String,
  pub package_version: String,
  pub display_name: String,
  pub created_at: String,
  pub categories: Vec<Category>,
  pub passages: Vec<Passage>,
  pub questions: Vec<Question>,
}

#[derive(Deserialize, Debug)]
enum Format {
  #[serde(rename = "lsat-prep-package")]
  V1,
}

#[derive(Serialize, Deserialize, Debug, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum Section {
  LogicalReasoning,
  ReadingComprehension,
}

impl Section {
  pub fn as_str(self) -> &'static str {
    match self {
      Section::LogicalReasoning => "logical_reasoning",
      Section::ReadingComprehension => "reading_comprehension",
    }
  }
}

#[derive(Serialize, Deserialize, Debug, Clone, Copy, PartialEq, Eq)]
pub enum Label {
  A,
  B,
  C,
  D,
  E,
}

impl Label {
  pub fn as_str(self) -> &'static str {
    ["A", "B", "C", "D", "E"][self as usize]
  }
}

#[derive(Serialize, Deserialize, Debug, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct Category {
  pub id: String,
  pub section: Section,
  pub name: String,
  pub description: String,
  pub sort_order: i64,
}

#[derive(Serialize, Deserialize, Debug, PartialEq)]
#[serde(rename_all = "snake_case")]
enum Origin {
  OriginalHumanWritten,
  OriginalAiAssistedHumanReviewed,
  Licensed,
}

#[derive(Serialize, Deserialize, Debug, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct Provenance {
  origin: Origin,
  source_material_used: String,
  authoring_batch: String,
  license_reference: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum Approved {
  Approved,
}

#[derive(Serialize, Deserialize, Debug, PartialEq)]
#[serde(rename_all = "snake_case")]
enum Passed {
  Passed,
}

#[derive(Serialize, Deserialize, Debug, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct Quality {
  draft_status: Approved,
  independent_solve: Passed,
  ambiguity_review: Passed,
  human_review: Passed,
  reviewer_notes: String,
}

#[derive(Serialize, Deserialize, Debug, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum PassageType {
  Single,
  Comparative,
}

impl PassageType {
  pub fn as_str(self) -> &'static str {
    match self {
      PassageType::Single => "single",
      PassageType::Comparative => "comparative",
    }
  }
}

#[derive(Serialize, Deserialize, Debug, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct LabeledText {
  pub label: Label,
  pub text: String,
}

#[derive(Serialize, Deserialize, Debug, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct Passage {
  pub id: String,
  pub title: String,
  pub passage_type: PassageType,
  pub texts: Vec<LabeledText>,
  pub content_version: i64,
  pub status: Approved,
  pub provenance: Provenance,
}

#[derive(Serialize, Deserialize, Debug, PartialEq)]
#[serde(deny_unknown_fields, rename_all = "UPPERCASE")]
pub struct Explanations {
  pub a: String,
  pub b: String,
  pub c: String,
  pub d: String,
  pub e: String,
}

impl Explanations {
  pub fn get(&self, label: Label) -> &str {
    [&self.a, &self.b, &self.c, &self.d, &self.e][label as usize]
  }
}

#[derive(Serialize, Deserialize, Debug, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct Question {
  pub id: String,
  pub section: Section,
  pub primary_category: String,
  /// A set: the order of tags has no meaning.
  pub secondary_tags: BTreeSet<String>,
  pub difficulty: i64,
  pub stimulus: Option<String>,
  pub prompt: String,
  pub choices: Vec<LabeledText>,
  pub correct_choice: Label,
  pub explanations: Explanations,
  pub estimated_time_seconds: Option<i64>,
  pub passage_id: Option<String>,
  pub content_version: i64,
  pub provenance: Provenance,
  pub quality: Quality,
}

/// Reads a package, or returns a plain-language reason it was refused.
pub fn read(bytes: &[u8]) -> Result<Package, String> {
  if bytes.len() > MAX_BYTES {
    return Err("The file is larger than the 20 MB limit.".into());
  }
  let json = bytes.strip_prefix(b"\xEF\xBB\xBF").unwrap_or(bytes);
  let package: Package = serde_json::from_slice(json).map_err(|error| {
    // Not the error text itself: it can repeat untrusted file content.
    format!(
      "The file does not follow the question package format (near line {}, column {}).",
      error.line(),
      error.column()
    )
  })?;
  if package.schema_version != 1 {
    return Err("The package uses a format version this app does not support.".into());
  }
  if package.questions.is_empty() {
    return Err("The package has no questions.".into());
  }
  for question in &package.questions {
    if !question.choices.iter().map(|choice| choice.label).eq(LABELS) {
      return Err("Every question must have exactly five choices, A through E, in order.".into());
    }
  }
  for passage in &package.passages {
    let expected = match passage.passage_type {
      PassageType::Single => &LABELS[..1],
      PassageType::Comparative => &LABELS[..2],
    };
    if !passage.texts.iter().map(|text| text.label).eq(expected.iter().copied()) {
      return Err("A single passage needs text A, and a comparative passage texts A and B.".into());
    }
  }
  if !all_unique(package.categories.iter().map(|item| &item.id))
    || !all_unique(package.passages.iter().map(|item| &item.id))
    || !all_unique(package.questions.iter().map(|item| &item.id))
  {
    return Err("The package uses the same ID more than once.".into());
  }
  Ok(package)
}

fn all_unique<'a>(ids: impl Iterator<Item = &'a String>) -> bool {
  let mut seen = BTreeSet::new();
  ids.into_iter().all(|id| seen.insert(id))
}
