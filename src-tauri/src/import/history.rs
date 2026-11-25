//! The import history shown to the user.

use rusqlite::{Connection, params};
use serde::Serialize;

use super::{ImportError, Plan};

#[derive(Serialize, Debug, PartialEq)]
pub struct Entry {
  pub id: String,
  pub package_id: Option<String>,
  pub package_version: Option<String>,
  pub display_name: Option<String>,
  pub attempted_at: String,
  pub status: String,
  pub questions_added: i64,
  pub passages_added: i64,
  pub categories_added: i64,
  pub duplicates_skipped: i64,
  pub summary: String,
}

const INSERT: &str = "INSERT INTO content_import_history (id, package_id, package_version,
    schema_version, display_name, attempted_at, status, questions_added, passages_added,
    categories_added, duplicates_skipped, summary)
  VALUES (lower(hex(randomblob(16))), ?1, ?2, ?3, ?4, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
    ?5, ?6, ?7, ?8, ?9, ?10)";

pub(super) fn record_success(conn: &Connection, plan: &Plan, schema: i64) -> rusqlite::Result<()> {
  let added = plan.questions.new.len();
  let skipped = plan.questions.skipped.len() + plan.passages.skipped.len() + plan.categories.skipped.len();
  conn.execute(
    INSERT,
    params![
      plan.package_id,
      plan.package_version,
      schema,
      plan.display_name,
      "succeeded",
      added as i64,
      plan.passages.new.len() as i64,
      plan.categories.new.len() as i64,
      skipped as i64,
      format!("Added {added} question{}.", if added == 1 { "" } else { "s" })
    ],
  )?;
  Ok(())
}

pub(super) fn record_failure(
  conn: &Connection,
  plan: &Plan,
  error: &ImportError,
) -> rusqlite::Result<()> {
  let status = match error {
    ImportError::Failed(_) => "failed_rollback",
    ImportError::Refused(_) | ImportError::Changed => "rejected_validation",
  };
  conn.execute(
    INSERT,
    params![
      plan.package_id,
      plan.package_version,
      None::<i64>,
      plan.display_name,
      status,
      0,
      0,
      0,
      0,
      shorten(&error.to_string())
    ],
  )?;
  Ok(())
}

/// Records a file that failed validation before a preview was possible. Its details are
/// not stored, because nothing in an invalid file can be trusted.
pub fn record_rejection(conn: &Connection, summary: &str) -> rusqlite::Result<()> {
  let nothing = None::<String>;
  conn.execute(
    INSERT,
    params![nothing, nothing, nothing, nothing, "rejected_validation", 0, 0, 0, 0, shorten(summary)],
  )?;
  Ok(())
}

fn shorten(text: &str) -> String {
  text.chars().take(1000).collect()
}

/// Most recent first.
pub fn list(conn: &Connection) -> rusqlite::Result<Vec<Entry>> {
  conn
    .prepare(
      "SELECT id, package_id, package_version, display_name, attempted_at, status,
         questions_added, passages_added, categories_added, duplicates_skipped, summary
       FROM content_import_history ORDER BY attempted_at DESC, rowid DESC LIMIT 200",
    )?
    .query_map([], |row| {
      Ok(Entry {
        id: row.get(0)?,
        package_id: row.get(1)?,
        package_version: row.get(2)?,
        display_name: row.get(3)?,
        attempted_at: row.get(4)?,
        status: row.get(5)?,
        questions_added: row.get(6)?,
        passages_added: row.get(7)?,
        categories_added: row.get(8)?,
        duplicates_skipped: row.get(9)?,
        summary: row.get(10)?,
      })
    })?
    .collect()
}
