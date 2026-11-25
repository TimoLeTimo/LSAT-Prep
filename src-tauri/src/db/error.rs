use std::fmt;

#[derive(Debug)]
pub enum DbError {
  Sqlite(rusqlite::Error),
  File(std::io::Error),
  Damaged,
  NotOurs,
  TooNew { found: i64, supported: i64 },
  Backup(Box<DbError>),
}

/// Messages are shown to the user.
impl fmt::Display for DbError {
  fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
    match self {
      DbError::Sqlite(error) if is_damage(error) => write!(f, "The data file is damaged."),
      DbError::Sqlite(error) => write!(f, "The data file could not be used ({error})."),
      DbError::File(error) => write!(f, "The data folder could not be used ({error})."),
      DbError::Damaged => write!(f, "The data file is damaged."),
      DbError::NotOurs => write!(f, "The data file was not created by LSAT Prep."),
      DbError::TooNew { found, supported } => write!(
        f,
        "The data was saved by a newer version of LSAT Prep (data version {found}; this app supports {supported})."
      ),
      DbError::Backup(error) => {
        write!(f, "A backup could not be made, so the update was not started. {error}")
      }
    }
  }
}

fn is_damage(error: &rusqlite::Error) -> bool {
  matches!(
    error.sqlite_error_code(),
    Some(rusqlite::ErrorCode::DatabaseCorrupt | rusqlite::ErrorCode::NotADatabase)
  )
}

impl std::error::Error for DbError {}

impl From<rusqlite::Error> for DbError {
  fn from(error: rusqlite::Error) -> Self {
    DbError::Sqlite(error)
  }
}

impl From<std::io::Error> for DbError {
  fn from(error: std::io::Error) -> Self {
    DbError::File(error)
  }
}
