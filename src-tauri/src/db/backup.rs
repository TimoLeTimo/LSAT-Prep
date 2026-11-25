//! Backups the user makes, and restoring them.
//!
//! A backup file is untrusted. It is copied into the app's folder, and its structure must
//! match exactly what this app creates before anything in it is used.

use std::{
  fs,
  path::{Path, PathBuf},
};

use rusqlite::{
  Connection,
  backup::{Backup, StepResult},
  config::DbConfig,
};
use serde::Serialize;

use super::{DbError, FILE_NAME, check_ownership, migrations, open_with};

const STAGING: &str = "restore";
const MAX_BYTES: u64 = 2 * 1024 * 1024 * 1024;

/// What a database holds, for comparing before a restore.
#[derive(Serialize, Debug, PartialEq, Clone)]
pub struct Summary {
  pub questions: i64,
  pub answers: i64,
  pub bookmarks: i64,
  pub templates: i64,
  pub finished_sessions: i64,
  pub unfinished_sessions: i64,
  /// The latest answer or session, or null if there are none.
  pub last_activity: Option<String>,
}

pub fn summary(conn: &Connection) -> Result<Summary, DbError> {
  Ok(conn.query_row(
    "SELECT (SELECT count(*) FROM questions), (SELECT count(*) FROM attempts),
       (SELECT count(*) FROM bookmarks), (SELECT count(*) FROM saved_practice_templates),
       (SELECT count(*) FROM practice_sessions WHERE status = 'completed'),
       (SELECT count(*) FROM practice_sessions WHERE status = 'in_progress'),
       (SELECT max(time) FROM (SELECT max(attempted_at) AS time FROM attempts
          UNION ALL SELECT max(created_at) FROM practice_sessions))",
    [],
    |row| {
      Ok(Summary {
        questions: row.get(0)?,
        answers: row.get(1)?,
        bookmarks: row.get(2)?,
        templates: row.get(3)?,
        finished_sessions: row.get(4)?,
        unfinished_sessions: row.get(5)?,
        last_activity: row.get(6)?,
      })
    },
  )?)
}

// ---------------------------------------------------------------- Backing up

/// Saves one complete, checked file. An existing file is replaced only once the new one is
/// known to be good.
pub fn export(conn: &Connection, dir: &Path, destination: &Path) -> Result<(), DbError> {
  let (Some(folder), Some(name)) = (destination.parent(), destination.file_name()) else {
    return Err(DbError::Refused("Choose a file name for the backup."));
  };
  // Never over the live data or its side files.
  if fs::canonicalize(folder)? == fs::canonicalize(dir)? {
    return Err(DbError::Refused("Choose a folder other than LSAT Prep's own data folder."));
  }
  let partial = folder.join(format!("{}.partial", name.to_string_lossy()));
  let result = write_copy(conn, &partial).and_then(|()| Ok(fs::rename(&partial, destination)?));
  if result.is_err() {
    let _ = fs::remove_file(&partial);
  }
  result
}

/// Writes a single self-contained file, and checks it before it is trusted.
pub(super) fn write_copy(conn: &Connection, path: &Path) -> Result<(), DbError> {
  if path.exists() {
    fs::remove_file(path)?;
  }
  let mut copy = Connection::open(path)?;
  copy_all(conn, &mut copy)?;
  copy.pragma_update(None, "journal_mode", "DELETE")?;
  check_integrity(&copy)?;
  copy.close().map_err(|(_, error)| error)?;
  fs::File::open(path)?.sync_all()?;
  Ok(())
}

/// Copies in one step, so it either takes effect completely or not at all. If another
/// program is using the file, this fails rather than waiting forever.
fn copy_all(from: &Connection, to: &mut Connection) -> Result<(), DbError> {
  match Backup::new(from, to)?.step(-1)? {
    StepResult::Done => Ok(()),
    _ => Err(DbError::Refused("The data is being used by another program. Try again.")),
  }
}

fn check_integrity(conn: &Connection) -> Result<(), DbError> {
  let result: String = conn.query_row("PRAGMA integrity_check(1)", [], |row| row.get(0))?;
  let orphans: i64 =
    conn.query_row("SELECT count(*) FROM pragma_foreign_key_check", [], |row| row.get(0))?;
  if result == "ok" && orphans == 0 { Ok(()) } else { Err(DbError::Damaged) }
}

// ---------------------------------------------------------------- Restoring

fn staging(dir: &Path) -> PathBuf {
  dir.join(STAGING)
}

/// Removes a backup that was chosen but not restored.
pub fn clear_staging(dir: &Path) {
  let _ = fs::remove_dir_all(staging(dir));
}

/// Copies a chosen backup, checks it, and upgrades the copy. The chosen file is only read,
/// and the current data is not touched.
pub fn stage(dir: &Path, chosen: &Path) -> Result<Summary, DbError> {
  stage_with(dir, chosen, migrations::ALL)
}

pub(super) fn stage_with(
  dir: &Path,
  chosen: &Path,
  migrations: &[&str],
) -> Result<Summary, DbError> {
  clear_staging(dir);
  let result = check_copy(dir, chosen, migrations);
  if result.is_err() {
    clear_staging(dir);
  }
  result
}

fn check_copy(dir: &Path, chosen: &Path, all: &[&str]) -> Result<Summary, DbError> {
  let info = fs::metadata(chosen)?;
  if !info.is_file() {
    return Err(DbError::Refused("Choose a file, not a folder."));
  }
  if info.len() > MAX_BYTES {
    return Err(DbError::Refused("The file is larger than the 2 GB limit."));
  }
  let folder = staging(dir);
  fs::create_dir_all(&folder)?;
  let copy = folder.join(FILE_NAME);
  fs::copy(chosen, &copy)?;
  // A copy of live data may have recent changes in a side file.
  let side = PathBuf::from(format!("{}-wal", chosen.display()));
  if side.is_file() && fs::metadata(&side)?.len() <= MAX_BYTES {
    fs::copy(&side, folder.join(format!("{FILE_NAME}-wal")))?;
  }

  let conn = Connection::open(&copy)?;
  // Nothing stored in the file may run while it is being checked.
  conn.set_db_config(DbConfig::SQLITE_DBCONFIG_TRUSTED_SCHEMA, false)?;
  conn.set_db_config(DbConfig::SQLITE_DBCONFIG_ENABLE_TRIGGER, false)?;
  conn.set_db_config(DbConfig::SQLITE_DBCONFIG_ENABLE_VIEW, false)?;
  check_ownership(&conn)?;
  let version = migrations::check_version(&conn, all)?;
  if version == 0 {
    return Err(DbError::NotOurs);
  }
  if schema(&conn)? != expected_schema(&all[..version as usize])? {
    return Err(DbError::Refused("The file does not have the structure of LSAT Prep data."));
  }
  check_integrity(&conn)?;
  conn.close().map_err(|(_, error)| error)?;

  // Safe to open normally now. Upgrades it if needed.
  let conn = open_with(&folder, all)?;
  check_integrity(&conn)?;
  let summary = summary(&conn)?;
  super::tidy(&conn)?;
  conn.pragma_update(None, "journal_mode", "DELETE")?;
  conn.close().map_err(|(_, error)| error)?;
  Ok(summary)
}

type Schema = Vec<(String, String, String, Option<String>)>;

fn schema(conn: &Connection) -> Result<Schema, DbError> {
  Ok(
    conn
      .prepare("SELECT type, name, tbl_name, sql FROM sqlite_schema ORDER BY type, name")?
      .query_map([], |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)))?
      .collect::<rusqlite::Result<_>>()?,
  )
}

/// The exact structure this app creates at some version.
fn expected_schema(migrations: &[&str]) -> Result<Schema, DbError> {
  let conn = Connection::open_in_memory()?;
  for sql in migrations {
    conn.execute_batch(sql)?;
  }
  schema(&conn)
}

fn staged_file(dir: &Path) -> Result<PathBuf, DbError> {
  let file = staging(dir).join(FILE_NAME);
  if file.is_file() { Ok(file) } else { Err(DbError::Refused("Choose a backup first.")) }
}

/// Replaces the current data with the staged backup, after backing up the current data.
/// Returns the name of that backup. If anything fails, the current data is unchanged.
pub fn restore(conn: &mut Connection, dir: &Path) -> Result<String, DbError> {
  let staged = Connection::open(staged_file(dir)?)?;
  let name = migrations::back_up(conn, dir, "before-restore")
    .map_err(|error| DbError::Backup(Box::new(error)))?;
  // SQLite copies in one transaction: all of it takes effect, or none.
  copy_all(&staged, conn)?;
  drop(staged);
  conn.pragma_update(None, "journal_mode", "WAL")?;
  check_integrity(conn)?;
  clear_staging(dir);
  Ok(name)
}

/// For data that cannot be opened: moves it aside, unchanged, and puts the staged backup
/// in its place. Returns the new connection and the folder the old files were moved to.
pub fn restore_over_unreadable(dir: &Path) -> Result<(Connection, String), DbError> {
  let staged = staged_file(dir)?;
  let name = format!("unreadable-{}", migrations::timestamp(&Connection::open_in_memory()?)?);
  let aside = dir.join("backups").join(&name);
  fs::create_dir_all(&aside)?;
  let files = ["", "-wal", "-shm"].map(|suffix| format!("{FILE_NAME}{suffix}"));
  let mut moved = Vec::new();
  let result = (|| {
    for file in &files {
      if dir.join(file).exists() {
        fs::rename(dir.join(file), aside.join(file))?;
        moved.push(file);
      }
    }
    fs::copy(&staged, dir.join(FILE_NAME))?;
    super::open(dir)
  })();
  match result {
    Ok(conn) => {
      clear_staging(dir);
      Ok((conn, name))
    }
    Err(error) => {
      // Put everything back as it was.
      for file in &files {
        let _ = fs::remove_file(dir.join(file));
      }
      for file in moved {
        let _ = fs::rename(aside.join(file), dir.join(file));
      }
      let _ = fs::remove_dir(&aside);
      Err(error)
    }
  }
}

/// Explains why a backup could not be saved.
pub fn explain_save(error: &DbError) -> String {
  match error {
    DbError::Refused(reason) => (*reason).into(),
    DbError::Damaged => "The data could not be copied correctly, so no backup was saved.".into(),
    _ => "The backup could not be saved there. Check the location and its free space.".into(),
  }
}

/// Explains why a chosen file cannot be restored.
pub fn explain(error: &DbError) -> String {
  match error {
    DbError::NotOurs => "This file is not an LSAT Prep backup.".into(),
    DbError::Damaged => "This backup is damaged and cannot be restored.".into(),
    DbError::TooNew { .. } => {
      "This backup was made by a newer version of LSAT Prep, so this version cannot restore it."
        .into()
    }
    DbError::Sqlite(_) => "This file is not an LSAT Prep backup, or it is damaged.".into(),
    DbError::File(_) => "The file could not be read or written.".into(),
    other => other.to_string(),
  }
}
