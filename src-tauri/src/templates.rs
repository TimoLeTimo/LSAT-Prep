//! Saved custom-practice choices. A template never holds questions, so each use picks
//! fresh ones.

use rusqlite::{Connection, Transaction, TransactionBehavior, params};
use serde::{Deserialize, Serialize};

use crate::{
  import::package::Section,
  practice::{Explanations, PracticeError, Subset},
};

type Result<T> = std::result::Result<T, PracticeError>;

const MAX_TEMPLATES: i64 = 50;
const MAX_NAME: usize = 60;
const MAX_CATEGORIES: usize = 500;

/// The section and name are kept so a category that is later removed can be explained.
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct ChosenCategory {
  id: String,
  section: Section,
  name: String,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct Choices {
  categories: Vec<ChosenCategory>,
  difficulties: Vec<i64>,
  lr_count: i64,
  passage_count: i64,
  subset: Subset,
  exclude_correct: bool,
  shuffle_questions: bool,
  shuffle_answers: bool,
  explanations: Explanations,
  time_limit_seconds: Option<i64>,
}

#[derive(Serialize, Debug, PartialEq)]
pub struct Template {
  pub id: String,
  pub name: String,
  /// Null if the saved choices cannot be read. It can still be renamed or deleted.
  pub choices: Option<Choices>,
}

fn refused<T>(reason: &'static str) -> Result<T> {
  Err(PracticeError::Refused(reason))
}

fn begin(conn: &mut Connection) -> rusqlite::Result<Transaction<'_>> {
  conn.transaction_with_behavior(TransactionBehavior::Immediate)
}

/// In order of name, ignoring capitals.
pub fn list(conn: &Connection) -> Result<Vec<Template>> {
  let mut templates = conn
    .prepare("SELECT id, name, configuration_json FROM saved_practice_templates")?
    .query_map([], |row| {
      let json: String = row.get(2)?;
      Ok(Template {
        id: row.get(0)?,
        name: row.get(1)?,
        choices: serde_json::from_str(&json).ok().filter(|choices| check(choices).is_ok()),
      })
    })?
    .collect::<rusqlite::Result<Vec<_>>>()?;
  templates.sort_by_key(|template| (template.name.to_lowercase(), template.id.clone()));
  Ok(templates)
}

pub fn create(conn: &mut Connection, name: &str, choices: &Choices) -> Result<()> {
  check(choices)?;
  let tx = begin(conn)?;
  let name = check_name(&tx, name, None)?;
  let total: i64 =
    tx.query_row("SELECT count(*) FROM saved_practice_templates", [], |row| row.get(0))?;
  if total >= MAX_TEMPLATES {
    return refused("You have 50 templates, which is the most allowed. Delete one first.");
  }
  tx.execute(
    "INSERT INTO saved_practice_templates (id, name, configuration_json, created_at, updated_at)
     VALUES (lower(hex(randomblob(16))), ?1, ?2, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
       strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))",
    params![name, to_json(choices)?],
  )?;
  Ok(tx.commit()?)
}

/// Replaces the saved choices and keeps the name.
pub fn update(conn: &mut Connection, id: &str, choices: &Choices) -> Result<()> {
  check(choices)?;
  let changed = conn.execute(
    "UPDATE saved_practice_templates SET configuration_json = ?2,
       updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?1",
    params![id, to_json(choices)?],
  )?;
  found(changed)
}

pub fn rename(conn: &mut Connection, id: &str, name: &str) -> Result<()> {
  let tx = begin(conn)?;
  let name = check_name(&tx, name, Some(id))?;
  let changed = tx.execute(
    "UPDATE saved_practice_templates SET name = ?2,
       updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?1",
    [id, &name],
  )?;
  found(changed)?;
  Ok(tx.commit()?)
}

pub fn delete(conn: &mut Connection, id: &str) -> Result<()> {
  found(conn.execute("DELETE FROM saved_practice_templates WHERE id = ?1", [id])?)
}

fn found(changed: usize) -> Result<()> {
  if changed == 1 { Ok(()) } else { refused("This template was not found.") }
}

fn to_json(choices: &Choices) -> rusqlite::Result<String> {
  serde_json::to_string(choices)
    .map_err(|error| rusqlite::Error::ToSqlConversionFailure(Box::new(error)))
}

/// Returns the name to save: trimmed, and not used by another template.
fn check_name(conn: &Connection, name: &str, own_id: Option<&str>) -> Result<String> {
  let name = name.trim();
  let length = name.chars().count();
  if length == 0 || length > MAX_NAME || name.chars().any(char::is_control) {
    return refused("Enter a name of 1 to 60 characters.");
  }
  let wanted = name.to_lowercase();
  let mut statement = conn.prepare("SELECT id, name FROM saved_practice_templates")?;
  let taken = statement
    .query_map([], |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?)))?
    .collect::<rusqlite::Result<Vec<_>>>()?
    .into_iter()
    .any(|(id, other)| Some(id.as_str()) != own_id && other.to_lowercase() == wanted);
  if taken {
    return refused("Another template already has this name.");
  }
  Ok(name.to_owned())
}

fn check(choices: &Choices) -> Result<()> {
  let Choices { categories, difficulties, lr_count, passage_count, time_limit_seconds, .. } = choices;
  let is_valid = (0..=500).contains(lr_count)
    && (0..=50).contains(passage_count)
    && lr_count + passage_count > 0
    && categories.len() <= MAX_CATEGORIES
    && difficulties.iter().all(|level| (1..=4).contains(level))
    && time_limit_seconds.is_none_or(|limit| (60..=21600).contains(&limit) && limit % 60 == 0);
  if is_valid { Ok(()) } else { refused("These choices cannot be saved.") }
}

#[cfg(test)]
mod tests {
  use super::*;
  use crate::db::{self, test_support::TempDir};

  fn choices() -> Choices {
    Choices {
      categories: vec![ChosenCategory {
        id: "lr-flaw".into(),
        section: Section::LogicalReasoning,
        name: "Flaw".into(),
      }],
      difficulties: vec![2, 3],
      lr_count: 10,
      passage_count: 1,
      subset: Subset::Missed,
      exclude_correct: true,
      shuffle_questions: true,
      shuffle_answers: false,
      explanations: Explanations::AtEnd,
      time_limit_seconds: Some(900),
    }
  }

  fn names(conn: &Connection) -> Vec<String> {
    list(conn).unwrap().into_iter().map(|template| template.name).collect()
  }

  fn id(conn: &Connection, name: &str) -> String {
    list(conn).unwrap().into_iter().find(|template| template.name == name).unwrap().id
  }

  fn refusal<T: std::fmt::Debug>(result: Result<T>) -> &'static str {
    match result {
      Err(PracticeError::Refused(reason)) => reason,
      other => panic!("expected a refusal, got {other:?}"),
    }
  }

  #[test]
  fn saves_everything_and_survives_reopening() {
    let dir = TempDir::new();
    let mut conn = db::open(&dir.0).unwrap();
    create(&mut conn, "  Weak spots ", &choices()).unwrap();
    drop(conn);
    let found = list(&db::open(&dir.0).unwrap()).unwrap();
    assert_eq!((found.len(), found[0].name.as_str()), (1, "Weak spots"));
    assert_eq!(found[0].choices, Some(choices()));
  }

  #[test]
  fn names_are_unique_ignoring_capitals_and_spaces_around_them() {
    let dir = TempDir::new();
    let mut conn = db::open(&dir.0).unwrap();
    create(&mut conn, "Éxam one", &choices()).unwrap();
    for name in ["Éxam one", "éXAM ONE", "  éxam one  "] {
      assert!(refusal(create(&mut conn, name, &choices())).contains("already has"), "{name}");
    }
    create(&mut conn, "Other", &choices()).unwrap();
    let other = id(&conn, "Other");
    assert!(refusal(rename(&mut conn, &other, "éxam ONE")).contains("already has"));
    rename(&mut conn, &other, "OTHER").unwrap();
    assert_eq!(names(&conn), ["OTHER", "Éxam one"]);
  }

  #[test]
  fn refuses_unusable_names() {
    let dir = TempDir::new();
    let mut conn = db::open(&dir.0).unwrap();
    create(&mut conn, "Mine", &choices()).unwrap();
    let mine = id(&conn, "Mine");
    let long = "é".repeat(61);
    for name in ["", "   ", long.as_str(), "two\nlines", "null\0"] {
      assert!(refusal(create(&mut conn, name, &choices())).contains("1 to 60"));
      assert!(refusal(rename(&mut conn, &mine, name)).contains("1 to 60"));
    }
    create(&mut conn, &"é".repeat(60), &choices()).unwrap();
    create(&mut conn, "'); DROP TABLE attempts; --", &choices()).unwrap();
    assert_eq!(names(&conn).len(), 3);
  }

  #[test]
  fn refuses_choices_outside_the_limits() {
    let dir = TempDir::new();
    let mut conn = db::open(&dir.0).unwrap();
    create(&mut conn, "Good", &choices()).unwrap();
    let good = id(&conn, "Good");
    let bad: [fn(&mut Choices); 9] = [
      |c| c.lr_count = -1,
      |c| c.lr_count = 501,
      |c| c.passage_count = 51,
      |c| (c.lr_count, c.passage_count) = (0, 0),
      |c| c.difficulties = vec![5],
      |c| c.time_limit_seconds = Some(59),
      |c| c.time_limit_seconds = Some(21660),
      |c| c.time_limit_seconds = Some(90),
      |c| c.categories = vec![c.categories[0].clone(); 501],
    ];
    for change in bad {
      let mut changed = choices();
      change(&mut changed);
      assert!(refusal(create(&mut conn, "Bad", &changed)).contains("cannot be saved"));
      assert!(refusal(update(&mut conn, &good, &changed)).contains("cannot be saved"));
    }
    assert_eq!(list(&conn).unwrap()[0].choices, Some(choices()));
  }

  #[test]
  fn updates_renames_and_deletes_only_the_one_named() {
    let dir = TempDir::new();
    let mut conn = db::open(&dir.0).unwrap();
    for name in ["A", "B", "C"] {
      create(&mut conn, name, &choices()).unwrap();
    }
    let b = id(&conn, "B");
    let changed = Choices { lr_count: 3, ..choices() };
    update(&mut conn, &b, &changed).unwrap();
    rename(&mut conn, &b, "Z").unwrap();
    let found = list(&conn).unwrap();
    assert_eq!(names(&conn), ["A", "C", "Z"]);
    assert_eq!(found[2].choices, Some(changed));
    assert_eq!(found[0].choices, Some(choices()));
    delete(&mut conn, &b).unwrap();
    assert_eq!(names(&conn), ["A", "C"]);
    for reason in [
      refusal(delete(&mut conn, &b)),
      refusal(rename(&mut conn, &b, "New")),
      refusal(update(&mut conn, &b, &choices())),
    ] {
      assert!(reason.contains("not found"));
    }
  }

  #[test]
  fn allows_fifty() {
    let dir = TempDir::new();
    let mut conn = db::open(&dir.0).unwrap();
    for number in 0..50 {
      create(&mut conn, &format!("T{number}"), &choices()).unwrap();
    }
    assert!(refusal(create(&mut conn, "One more", &choices())).contains("50"));
    let first = id(&conn, "T0");
    update(&mut conn, &first, &choices()).unwrap();
    delete(&mut conn, &first).unwrap();
    create(&mut conn, "One more", &choices()).unwrap();
  }

  #[test]
  fn unreadable_choices_do_not_hide_other_templates() {
    let dir = TempDir::new();
    let mut conn = db::open(&dir.0).unwrap();
    for name in ["Bad", "Good", "Old"] {
      create(&mut conn, name, &choices()).unwrap();
    }
    conn
      .execute_batch(
        "UPDATE saved_practice_templates SET configuration_json = '{}' WHERE name = 'Bad';
         UPDATE saved_practice_templates
           SET configuration_json = json_set(configuration_json, '$.lr_count', 9999) WHERE name = 'Old';",
      )
      .unwrap();
    let readable: Vec<_> =
      list(&conn).unwrap().into_iter().map(|template| template.choices.is_some()).collect();
    assert_eq!(readable, [false, true, false]);
    let bad = id(&conn, "Bad");
    rename(&mut conn, &bad, "Renamed").unwrap();
    delete(&mut conn, &bad).unwrap();
  }
}
