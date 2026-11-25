//! Reads and writes package content. Only INSERT is used: nothing is ever replaced.

use rusqlite::{Connection, OptionalExtension, Row, params, types::Type};
use serde::de::DeserializeOwned;

use super::package::*;

/// Converts stored text back into a package type, such as "A" into Label::A.
fn parse<T: DeserializeOwned>(row: &Row, index: usize, is_json: bool) -> rusqlite::Result<T> {
  let text: String = row.get(index)?;
  let value = if is_json {
    serde_json::from_str(&text)
  } else {
    serde_json::from_value(serde_json::Value::String(text))
  };
  value.map_err(|error| rusqlite::Error::FromSqlConversionFailure(index, Type::Text, Box::new(error)))
}

fn to_json<T: serde::Serialize>(value: &T) -> rusqlite::Result<String> {
  serde_json::to_string(value).map_err(|error| rusqlite::Error::ToSqlConversionFailure(Box::new(error)))
}

pub fn load_category(conn: &Connection, id: &str) -> rusqlite::Result<Option<Category>> {
  conn
    .prepare_cached(
      "SELECT id, section, name, description, sort_order FROM question_categories WHERE id = ?1",
    )?
    .query_row([id], |row| {
      Ok(Category {
        id: row.get(0)?,
        section: parse(row, 1, false)?,
        name: row.get(2)?,
        description: row.get(3)?,
        sort_order: row.get(4)?,
      })
    })
    .optional()
}

pub fn passage_status(conn: &Connection, id: &str) -> rusqlite::Result<Option<String>> {
  conn
    .prepare_cached("SELECT status FROM passages WHERE id = ?1")?
    .query_row([id], |row| row.get(0))
    .optional()
}

pub fn load_passage(conn: &Connection, id: &str) -> rusqlite::Result<Option<Passage>> {
  let texts = conn
    .prepare_cached("SELECT label, text FROM passage_texts WHERE passage_id = ?1 ORDER BY label")?
    .query_map([id], |row| Ok(LabeledText { label: parse(row, 0, false)?, text: row.get(1)? }))?
    .collect::<rusqlite::Result<Vec<_>>>()?;
  conn
    .prepare_cached(
      "SELECT id, title, passage_type, content_version, provenance_json FROM passages WHERE id = ?1",
    )?
    .query_row([id], |row| {
      Ok(Passage {
        id: row.get(0)?,
        title: row.get(1)?,
        passage_type: parse(row, 2, false)?,
        texts,
        content_version: row.get(3)?,
        // Status is managed by the app after import, so it is not compared.
        status: Approved::Approved,
        provenance: parse(row, 4, true)?,
      })
    })
    .optional()
}

pub fn load_question(conn: &Connection, id: &str) -> rusqlite::Result<Option<Question>> {
  let secondary_tags = conn
    .prepare_cached("SELECT tag FROM question_tags WHERE question_id = ?1")?
    .query_map([id], |row| row.get(0))?
    .collect::<rusqlite::Result<_>>()?;
  let stored = conn
    .prepare_cached(
      "SELECT choice_label, choice_text, explanation FROM answer_choices
       WHERE question_id = ?1 ORDER BY choice_label",
    )?
    .query_map([id], |row| {
      let choice = LabeledText { label: parse(row, 0, false)?, text: row.get(1)? };
      Ok((choice, row.get::<_, String>(2)?))
    })?
    .collect::<rusqlite::Result<Vec<_>>>()?;
  let (choices, explanations): (Vec<_>, Vec<_>) = stored.into_iter().unzip();
  let mut explanations = explanations.into_iter();
  let mut next = || explanations.next().unwrap_or_default();
  let explanations = Explanations { a: next(), b: next(), c: next(), d: next(), e: next() };

  conn
    .prepare_cached(
      "SELECT q.id, q.section, q.category_id, q.difficulty, q.stimulus, q.prompt, c.choice_label,
         q.estimated_seconds, q.passage_id, q.content_version, q.provenance_json, q.quality_json
       FROM questions q JOIN answer_choices c ON c.id = q.correct_choice_id WHERE q.id = ?1",
    )?
    .query_row([id], |row| {
      Ok(Question {
        id: row.get(0)?,
        section: parse(row, 1, false)?,
        primary_category: row.get(2)?,
        secondary_tags,
        difficulty: row.get(3)?,
        stimulus: row.get(4)?,
        prompt: row.get(5)?,
        choices,
        correct_choice: parse(row, 6, false)?,
        explanations,
        estimated_time_seconds: row.get(7)?,
        passage_id: row.get(8)?,
        content_version: row.get(9)?,
        provenance: parse(row, 10, true)?,
        quality: parse(row, 11, true)?,
      })
    })
    .optional()
}

pub fn insert_package(
  conn: &Connection,
  package: &Package,
  hash: &str,
  now: &str,
) -> rusqlite::Result<()> {
  conn.execute(
    "INSERT INTO content_packages (package_id, package_version, schema_version, display_name,
       created_at, imported_at, content_hash) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
    params![
      package.package_id,
      package.package_version,
      package.schema_version,
      package.display_name,
      package.created_at,
      now,
      hash
    ],
  )?;
  Ok(())
}

pub fn insert_category(conn: &Connection, category: &Category) -> rusqlite::Result<()> {
  conn.execute(
    "INSERT INTO question_categories (id, section, name, description, sort_order)
     VALUES (?1, ?2, ?3, ?4, ?5)",
    params![
      category.id,
      category.section.as_str(),
      category.name,
      category.description,
      category.sort_order
    ],
  )?;
  Ok(())
}

pub fn insert_passage(
  conn: &Connection,
  package: &Package,
  passage: &Passage,
  now: &str,
) -> rusqlite::Result<()> {
  conn
    .prepare_cached(
      "INSERT INTO passages (id, title, passage_type, content_version, status, provenance_json,
         package_id, package_version, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, 'approved', ?5, ?6, ?7, ?8, ?8)",
    )?
    .execute(params![
      passage.id,
      passage.title,
      passage.passage_type.as_str(),
      passage.content_version,
      to_json(&passage.provenance)?,
      package.package_id,
      package.package_version,
      now
    ])?;
  for text in &passage.texts {
    conn
      .prepare_cached("INSERT INTO passage_texts (passage_id, label, text) VALUES (?1, ?2, ?3)")?
      .execute(params![passage.id, text.label.as_str(), text.text])?;
  }
  Ok(())
}

pub fn insert_question(
  conn: &Connection,
  package: &Package,
  question: &Question,
  now: &str,
) -> rusqlite::Result<()> {
  let choice_id = |label: Label| format!("{}:{}", question.id, label.as_str());
  conn
    .prepare_cached(
      "INSERT INTO questions (id, section, category_id, difficulty, stimulus, prompt,
         correct_choice_id, estimated_seconds, passage_id, content_version, status,
         provenance_json, quality_json, package_id, package_version, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, 'approved', ?11, ?12, ?13, ?14, ?15, ?15)",
    )?
    .execute(params![
      question.id,
      question.section.as_str(),
      question.primary_category,
      question.difficulty,
      question.stimulus,
      question.prompt,
      choice_id(question.correct_choice),
      question.estimated_time_seconds,
      question.passage_id,
      question.content_version,
      to_json(&question.provenance)?,
      to_json(&question.quality)?,
      package.package_id,
      package.package_version,
      now
    ])?;
  for (order, choice) in question.choices.iter().enumerate() {
    conn
      .prepare_cached(
        "INSERT INTO answer_choices (id, question_id, choice_label, choice_text, explanation,
           display_order) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
      )?
      .execute(params![
        choice_id(choice.label),
        question.id,
        choice.label.as_str(),
        choice.text,
        question.explanations.get(choice.label),
        order as i64
      ])?;
  }
  for tag in &question.secondary_tags {
    conn
      .prepare_cached("INSERT INTO question_tags (question_id, tag) VALUES (?1, ?2)")?
      .execute([&question.id, tag])?;
  }
  Ok(())
}
