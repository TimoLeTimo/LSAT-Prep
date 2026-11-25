//! Imports question packages. Content is only ever added, in a single transaction.
//! User activity tables are never written.

mod history;
mod package;
mod plan;
mod store;
#[cfg(test)]
mod tests;

use std::{collections::BTreeSet, fmt};

use rusqlite::{Connection, TransactionBehavior};
use sha2::{Digest, Sha256};

use crate::db::DbError;
pub use history::{list as history, record_rejection};
use package::Package;
pub use plan::Plan;

#[derive(Debug)]
pub enum ImportError {
  /// Not allowed; nothing was written. Holds plain-language reasons.
  Refused(Vec<String>),
  /// Something differs from what the user confirmed; nothing was written.
  Changed,
  /// Saving failed and everything was undone.
  Failed(DbError),
}

/// Messages are shown to the user.
impl fmt::Display for ImportError {
  fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
    match self {
      ImportError::Refused(reasons) => f.write_str(&reasons.join("\n")),
      ImportError::Changed => write!(
        f,
        "The file or your question bank changed after the preview. Nothing was imported. Preview the file again."
      ),
      ImportError::Failed(error) => {
        write!(f, "The import could not be saved, so all of it was undone. {error}")
      }
    }
  }
}

impl From<rusqlite::Error> for ImportError {
  fn from(error: rusqlite::Error) -> Self {
    ImportError::Failed(error.into())
  }
}

fn read(bytes: &[u8]) -> Result<(Package, String), ImportError> {
  let package = package::read(bytes).map_err(|reason| ImportError::Refused(vec![reason]))?;
  let hash = Sha256::digest(bytes).iter().map(|byte| format!("{byte:02x}")).collect();
  Ok((package, hash))
}

/// Shows what importing this file would do. Writes nothing.
pub fn preview(conn: &mut Connection, bytes: &[u8]) -> Result<Plan, ImportError> {
  let (package, hash) = read(bytes)?;
  // A transaction gives one consistent view; it is dropped without saving.
  let tx = conn.transaction()?;
  Ok(plan::make(&tx, &package, &hash)?)
}

/// Imports the file if it still does exactly what the confirmed preview said.
/// Every outcome is recorded in the import history.
pub fn import(conn: &mut Connection, bytes: &[u8], confirmed: &Plan) -> Result<Plan, ImportError> {
  let result = run(conn, bytes, confirmed);
  if let Err(error) = &result {
    // Recorded separately, after the rollback. The original error matters more than a
    // failure to record it.
    let _ = history::record_failure(conn, confirmed, error);
  }
  result
}

fn run(conn: &mut Connection, bytes: &[u8], confirmed: &Plan) -> Result<Plan, ImportError> {
  let (package, hash) = match read(bytes) {
    Ok(found) => found,
    // The confirmed file was readable, so this must be a different one.
    Err(_) => return Err(ImportError::Changed),
  };

  // Takes the write lock first, so nothing can change between checking and writing.
  // Dropping the transaction without committing undoes everything.
  let tx = conn.transaction_with_behavior(TransactionBehavior::Immediate)?;
  let plan = plan::make(&tx, &package, &hash)?;
  if plan != *confirmed {
    return Err(ImportError::Changed);
  }
  if !plan.problems.is_empty() {
    return Err(ImportError::Refused(plan.problems));
  }

  let now: String =
    tx.query_row("SELECT strftime('%Y-%m-%dT%H:%M:%fZ', 'now')", [], |row| row.get(0))?;
  store::insert_package(&tx, &package, &hash, &now)?;
  for item in only_new(&package.categories, &plan.categories.new, |item| &item.id) {
    store::insert_category(&tx, item)?;
  }
  for item in only_new(&package.passages, &plan.passages.new, |item| &item.id) {
    store::insert_passage(&tx, &package, item, &now)?;
  }
  for item in only_new(&package.questions, &plan.questions.new, |item| &item.id) {
    store::insert_question(&tx, &package, item, &now)?;
  }
  history::record_success(&tx, &plan, package.schema_version)?;
  tx.commit()?;
  Ok(plan)
}

fn only_new<'a, T>(
  items: &'a [T],
  new: &[String],
  id: impl Fn(&T) -> &String,
) -> impl Iterator<Item = &'a T> {
  let new: BTreeSet<String> = new.iter().cloned().collect();
  items.iter().filter(move |item| new.contains(id(item)))
}
