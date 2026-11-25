mod db;
// Connected to the interface in Milestone 2 part 4b.
#[cfg_attr(not(test), allow(dead_code, unused_imports))]
mod import;

use std::sync::Mutex;

use rusqlite::Connection;
use tauri::{Manager, State};

/// The open database, or the reason it could not be opened.
struct Database(Result<Mutex<Connection>, String>);

/// Lets the interface show a clear message when saved data is unavailable.
#[tauri::command]
fn database_status(database: State<Database>) -> Result<(), String> {
  match &database.0 {
    Ok(connection) => {
      let connection = connection.lock().map_err(|_| "The data is unavailable.")?;
      connection.query_row("SELECT 1 FROM question_categories LIMIT 1", [], |_| Ok(()))
        .map_err(|error| db::DbError::from(error).to_string())
    }
    Err(message) => Err(message.clone()),
  }
}

pub fn run() {
  tauri::Builder::default()
    .setup(|app| {
      let database = match app.path().app_data_dir() {
        Ok(dir) => db::open(&dir).map(Mutex::new).map_err(|error| error.to_string()),
        Err(error) => Err(format!("The data folder could not be found ({error}).")),
      };
      app.manage(Database(database));
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![database_status])
    .run(tauri::generate_context!())
    .expect("error while running LSAT Prep");
}
