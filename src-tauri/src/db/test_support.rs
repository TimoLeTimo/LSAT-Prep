//! Helpers for tests only.

use std::{
  fs,
  path::PathBuf,
  sync::atomic::{AtomicU32, Ordering},
};

use super::FILE_NAME;

/// A temporary folder, removed when the test ends.
pub struct TempDir(pub PathBuf);

impl TempDir {
  pub fn new() -> Self {
    static NEXT: AtomicU32 = AtomicU32::new(0);
    let number = NEXT.fetch_add(1, Ordering::Relaxed);
    let path = std::env::temp_dir().join(format!("lsat-prep-test-{}-{number}", std::process::id()));
    fs::create_dir(&path).unwrap();
    TempDir(path)
  }
  pub fn file(&self) -> PathBuf {
    self.0.join(FILE_NAME)
  }
  pub fn backups(&self) -> Vec<PathBuf> {
    fs::read_dir(self.0.join("backups"))
      .map(|entries| entries.map(|entry| entry.unwrap().path()).collect())
      .unwrap_or_default()
  }
}

impl Drop for TempDir {
  fn drop(&mut self) {
    let _ = fs::remove_dir_all(&self.0);
  }
}
