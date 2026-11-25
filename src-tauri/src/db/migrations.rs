//! Numbered database updates. The database stores how many have been applied.

use std::{fs, path::Path};

use rusqlite::{Connection, TransactionBehavior};

use super::{APPLICATION_ID, DbError};

/// Add new migrations at the end. Never edit or reorder released ones.
pub const ALL: &[&str] = &[
  include_str!("../../migrations/0001_initial.sql"),
  include_str!("../../migrations/0002_session_clock.sql"),
  include_str!("../../migrations/0003_exams.sql"),
];

pub fn version(conn: &Connection) -> Result<i64, DbError> {
  Ok(conn.query_row("PRAGMA user_version", [], |row| row.get(0))?)
}

/// Refuses data saved by a newer app. Returns the current version.
pub fn check_version(conn: &Connection, migrations: &[&str]) -> Result<i64, DbError> {
  let found = version(conn)?;
  let supported = migrations.len() as i64;
  if !(0..=supported).contains(&found) {
    return Err(DbError::TooNew { found, supported });
  }
  Ok(found)
}

/// Applies all missing migrations in one transaction: either all succeed or none do.
pub fn run(conn: &mut Connection, dir: &Path, migrations: &[&str]) -> Result<(), DbError> {
  let current = check_version(conn, migrations)?;
  if current == migrations.len() as i64 {
    return Ok(());
  }
  if current > 0 {
    back_up(conn, dir, &format!("before-upgrade-v{current}"))
      .map_err(|error| DbError::Backup(Box::new(error)))?;
  }

  // Immediate: takes the write lock first, then rechecks in case another copy of the
  // app finished the update in the meantime.
  let tx = conn.transaction_with_behavior(TransactionBehavior::Immediate)?;
  let current = check_version(&tx, migrations)?;
  for sql in &migrations[current as usize..] {
    tx.execute_batch(sql)?;
  }
  tx.pragma_update(None, "application_id", APPLICATION_ID)?;
  tx.pragma_update(None, "user_version", migrations.len() as i64)?;
  tx.commit()?;
  Ok(())
}

/// A UTC time for file names, such as 20261124T120000000Z.
pub fn timestamp(conn: &Connection) -> Result<String, DbError> {
  let time: String =
    conn.query_row("SELECT strftime('%Y%m%dT%H%M%fZ', 'now')", [], |row| row.get(0))?;
  Ok(time.replace('.', ""))
}

/// Saves a complete copy of the current data, and returns its file name. These backups are
/// never deleted automatically.
pub fn back_up(conn: &Connection, dir: &Path, reason: &str) -> Result<String, DbError> {
  let folder = dir.join("backups");
  fs::create_dir_all(&folder)?;
  let name = format!("{reason}-{}", timestamp(conn)?);
  let partial = folder.join(format!("{name}.partial"));
  super::backup::write_copy(conn, &partial)?;
  let name = format!("{name}.db");
  fs::rename(&partial, folder.join(&name))?;
  Ok(name)
}
