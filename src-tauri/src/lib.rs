mod commands;
mod db;
mod import;

use std::sync::Mutex;

use tauri::{Builder, Manager, Runtime};

use commands::{CurrentImport, Database};

/// Everything the real app and the command tests share.
fn configure<R: Runtime>(builder: Builder<R>) -> Builder<R> {
  builder
    .plugin(tauri_plugin_dialog::init())
    .manage(CurrentImport::default())
    .invoke_handler(tauri::generate_handler![
      commands::database_status,
      commands::import_catalog,
      commands::import_history,
      commands::choose_package,
      commands::package_bytes,
      commands::reject_package,
      commands::preview_package,
      commands::cancel_import,
      commands::confirm_import,
    ])
}

pub fn run() {
  configure(tauri::Builder::default())
    .setup(|app| {
      let database = match app.path().app_data_dir() {
        Ok(dir) => db::open(&dir).map(Mutex::new).map_err(|error| error.to_string()),
        Err(error) => Err(format!("The data folder could not be found ({error}).")),
      };
      app.manage(Database(database));
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running LSAT Prep");
}
