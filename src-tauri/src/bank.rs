//! Reads the question bank. Only questions that can be practiced are returned.

use rusqlite::Connection;
use serde::Serialize;

#[derive(Serialize, Debug, PartialEq)]
pub struct QuestionSummary {
  id: String,
  section: String,
  category_id: String,
  difficulty: i64,
  passage_id: Option<String>,
}

#[derive(Serialize, Debug, PartialEq)]
pub struct Category {
  id: String,
  section: String,
  name: String,
}

#[derive(Serialize, Debug, PartialEq)]
pub struct QuestionIndex {
  categories: Vec<Category>,
  questions: Vec<QuestionSummary>,
}

/// Active categories, and approved questions in them. An RC question also needs an
/// approved passage. Questions are in the order they were imported, which keeps the order
/// within each passage.
pub fn index(conn: &Connection) -> rusqlite::Result<QuestionIndex> {
  let categories = conn
    .prepare(
      "SELECT id, section, name FROM question_categories WHERE active = 1
       ORDER BY section, sort_order, id",
    )?
    .query_map([], |row| Ok(Category { id: row.get(0)?, section: row.get(1)?, name: row.get(2)? }))?
    .collect::<rusqlite::Result<_>>()?;
  let questions = conn
    .prepare(
      "SELECT q.id, q.section, q.category_id, q.difficulty, q.passage_id
       FROM questions q
       JOIN question_categories c ON c.id = q.category_id
       LEFT JOIN passages p ON p.id = q.passage_id
       WHERE q.status = 'approved' AND c.active = 1
         AND (q.passage_id IS NULL OR p.status = 'approved')
       ORDER BY q.rowid",
    )?
    .query_map([], |row| {
      Ok(QuestionSummary {
        id: row.get(0)?,
        section: row.get(1)?,
        category_id: row.get(2)?,
        difficulty: row.get(3)?,
        passage_id: row.get(4)?,
      })
    })?
    .collect::<rusqlite::Result<_>>()?;
  Ok(QuestionIndex { categories, questions })
}

#[cfg(test)]
mod tests {
  use super::*;
  use crate::{
    db::{self, test_support::TempDir},
    import::Session,
  };

  const VALID: &str = include_str!("../../tests/fixtures/valid-package.json");

  fn imported(dir: &TempDir) -> Connection {
    let mut conn = db::open(&dir.0).unwrap();
    let path = dir.0.join("package.json");
    std::fs::write(&path, VALID).unwrap();
    let mut session = Session::default();
    session.choose(&conn, &path).unwrap();
    session.preview(&mut conn).unwrap();
    session.confirm(&mut conn).unwrap();
    conn
  }

  fn ids(conn: &Connection) -> Vec<String> {
    index(conn).unwrap().questions.into_iter().map(|question| question.id).collect()
  }

  #[test]
  fn a_new_database_has_categories_and_no_questions() {
    let dir = TempDir::new();
    let found = index(&db::open(&dir.0).unwrap()).unwrap();
    assert_eq!((found.categories.len(), found.questions.len()), (28, 0));
  }

  #[test]
  fn lists_imported_questions() {
    let dir = TempDir::new();
    let found = index(&imported(&dir)).unwrap();
    assert_eq!(found.categories.len(), 29);
    assert_eq!(
      found.questions[1],
      QuestionSummary {
        id: "test-rc-1".into(),
        section: "reading_comprehension".into(),
        category_id: "rc-detail".into(),
        difficulty: 2,
        passage_id: Some("test-passage-1".into()),
      }
    );
  }

  #[test]
  fn keeps_the_imported_order() {
    let dir = TempDir::new();
    let mut conn = imported(&dir);
    let mut package: serde_json::Value = serde_json::from_str(VALID).unwrap();
    package["package_id"] = "second".into();
    package["questions"][0]["id"] = "zz".into();
    package["questions"][1]["id"] = "aa".into();
    let path = dir.0.join("second.json");
    std::fs::write(&path, package.to_string()).unwrap();
    let mut session = Session::default();
    session.choose(&conn, &path).unwrap();
    session.preview(&mut conn).unwrap();
    session.confirm(&mut conn).unwrap();
    assert_eq!(ids(&conn), ["test-lr-1", "test-rc-1", "zz", "aa"]);
  }

  #[test]
  fn leaves_out_anything_that_cannot_be_practiced() {
    for status in ["draft", "reviewed", "retired"] {
      let dir = TempDir::new();
      let conn = imported(&dir);
      conn.execute("UPDATE questions SET status = ?1 WHERE id = 'test-lr-1'", [status]).unwrap();
      assert_eq!(ids(&conn), ["test-rc-1"], "{status}");
    }
    let dir = TempDir::new();
    let conn = imported(&dir);
    conn.execute("UPDATE passages SET status = 'retired'", []).unwrap();
    assert_eq!(ids(&conn), ["test-lr-1"]);
    conn.execute("UPDATE question_categories SET active = 0 WHERE id = 'lr-strengthen'", []).unwrap();
    assert!(ids(&conn).is_empty());
    assert_eq!(index(&conn).unwrap().categories.len(), 28);
  }
}
