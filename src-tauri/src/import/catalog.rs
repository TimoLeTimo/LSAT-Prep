//! What the interface needs to know to validate a package.

use rusqlite::Connection;
use serde::Serialize;

#[derive(Serialize)]
pub struct KnownCategory {
  id: String,
  section: String,
  name: String,
}

#[derive(Serialize)]
pub struct Catalog {
  categories: Vec<KnownCategory>,
  approved_passage_ids: Vec<String>,
}

pub fn load(conn: &Connection) -> rusqlite::Result<Catalog> {
  let categories = conn
    .prepare("SELECT id, section, name FROM question_categories ORDER BY section, sort_order")?
    .query_map([], |row| {
      Ok(KnownCategory { id: row.get(0)?, section: row.get(1)?, name: row.get(2)? })
    })?
    .collect::<rusqlite::Result<_>>()?;
  let approved_passage_ids = conn
    .prepare("SELECT id FROM passages WHERE status = 'approved'")?
    .query_map([], |row| row.get(0))?
    .collect::<rusqlite::Result<_>>()?;
  Ok(Catalog { categories, approved_passage_ids })
}
