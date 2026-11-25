//! The one import in progress. Only a file the user picked can be read, and only the
//! file that was previewed can be imported.

use std::{
  fs::File,
  io::Read,
  path::{Path, PathBuf},
};

use rusqlite::Connection;

use super::{ImportError, Plan, history, import, package::MAX_BYTES, preview};

struct Chosen {
  path: PathBuf,
  bytes: Vec<u8>,
  plan: Option<Plan>,
}

#[derive(Default)]
pub struct Session(Option<Chosen>);

const NOTHING_CHOSEN: &str = "No file is being imported. Choose a file first.";

fn refused(reason: &str) -> ImportError {
  ImportError::Refused(vec![reason.into()])
}

impl Session {
  /// Reads the file the user picked. Replaces any earlier choice.
  pub fn choose(&mut self, conn: &Connection, path: &Path) -> Result<(), ImportError> {
    self.cancel();
    match read_file(path) {
      Ok(bytes) => {
        self.0 = Some(Chosen { path: path.to_owned(), bytes, plan: None });
        Ok(())
      }
      Err(reason) => {
        let _ = history::record_rejection(conn, &reason);
        Err(refused(&reason))
      }
    }
  }

  pub fn bytes(&self) -> Result<&[u8], ImportError> {
    self.0.as_ref().map(|chosen| chosen.bytes.as_slice()).ok_or_else(|| refused(NOTHING_CHOSEN))
  }

  pub fn cancel(&mut self) {
    self.0 = None;
  }

  /// Ends the import because the interface found the file invalid.
  pub fn reject(&mut self, conn: &Connection, summary: &str) -> Result<(), ImportError> {
    self.0.take().ok_or_else(|| refused(NOTHING_CHOSEN))?;
    Ok(history::record_rejection(conn, summary)?)
  }

  /// A preview with problems ends the import, so it can never be confirmed.
  pub fn preview(&mut self, conn: &mut Connection) -> Result<Plan, ImportError> {
    let chosen = self.0.as_mut().ok_or_else(|| refused(NOTHING_CHOSEN))?;
    let plan = match preview(conn, &chosen.bytes) {
      Ok(plan) => plan,
      Err(error) => {
        self.cancel();
        let _ = history::record_rejection(conn, &error.to_string());
        return Err(error);
      }
    };
    if plan.problems.is_empty() {
      chosen.plan = Some(plan.clone());
    } else {
      self.cancel();
      let blocked = ImportError::Refused(plan.problems.clone());
      let _ = history::record_failure(conn, &plan, &blocked);
    }
    Ok(plan)
  }

  /// Imports the previewed file, reading it again first. Can only be used once.
  pub fn confirm(&mut self, conn: &mut Connection) -> Result<Plan, ImportError> {
    let chosen = self.0.take().ok_or_else(|| refused(NOTHING_CHOSEN))?;
    let plan = chosen.plan.ok_or_else(|| refused("Preview the file before importing it."))?;
    // An unreadable file gives no bytes, which the import reports as a change.
    let bytes = read_file(&chosen.path).unwrap_or_default();
    import(conn, &bytes, &plan)
  }
}

/// Reads a regular file, never more than the size limit.
fn read_file(path: &Path) -> Result<Vec<u8>, String> {
  let unreadable = |_| "The file could not be read.".to_string();
  if !path.metadata().map_err(unreadable)?.is_file() {
    return Err("Choose a file, not a folder or device.".into());
  }
  let mut bytes = Vec::new();
  let limit = MAX_BYTES as u64 + 1;
  File::open(path).map_err(unreadable)?.take(limit).read_to_end(&mut bytes).map_err(unreadable)?;
  if bytes.len() > MAX_BYTES {
    return Err("The file is larger than the 20 MB limit.".into());
  }
  Ok(bytes)
}
