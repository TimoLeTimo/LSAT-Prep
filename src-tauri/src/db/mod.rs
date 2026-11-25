//! Opens the local SQLite database and keeps its structure up to date.

mod error;
mod migrations;
#[cfg(test)]
mod tests;

use std::{fs, path::Path, time::Duration};

use rusqlite::Connection;

pub use error::DbError;

const FILE_NAME: &str = "lsat-prep.db";
/// Marks a SQLite file as belonging to this app ("LSAT" in ASCII).
const APPLICATION_ID: i64 = 0x4C53_4154;

/// Opens the database in `dir`, creating or upgrading it if needed.
pub fn open(dir: &Path) -> Result<Connection, DbError> {
  open_with(dir, migrations::ALL)
}

fn open_with(dir: &Path, migrations: &[&str]) -> Result<Connection, DbError> {
  fs::create_dir_all(dir)?;
  let mut conn = Connection::open(dir.join(FILE_NAME))?;
  conn.busy_timeout(Duration::from_secs(5))?;

  // Look before changing anything, so a file we do not recognize stays untouched.
  check_ownership(&conn)?;
  migrations::check_version(&conn, migrations)?;

  conn.pragma_update(None, "foreign_keys", true)?;
  conn.pragma_update(None, "journal_mode", "WAL")?;
  // Finish writing to disk before reporting a save as done.
  conn.pragma_update(None, "synchronous", "FULL")?;
  let damage: String = conn.query_row("PRAGMA quick_check(1)", [], |row| row.get(0))?;
  if damage != "ok" {
    return Err(DbError::Damaged);
  }

  migrations::run(&mut conn, dir, migrations)?;
  Ok(conn)
}

fn check_ownership(conn: &Connection) -> Result<(), DbError> {
  let id: i64 = conn.query_row("PRAGMA application_id", [], |row| row.get(0))?;
  let tables: i64 = conn.query_row("SELECT count(*) FROM sqlite_schema", [], |row| row.get(0))?;
  let is_new = id == 0 && tables == 0;
  if is_new || id == APPLICATION_ID {
    Ok(())
  } else {
    Err(DbError::NotOurs)
  }
}
