//! The only operations the interface can ask for. Each also needs permission in
//! capabilities/default.json. `async` keeps slow work from freezing the window.

use std::sync::{Mutex, MutexGuard};

use rusqlite::Connection;
use tauri::{Runtime, State, WebviewWindow, ipc::Response};
use tauri_plugin_dialog::DialogExt;

use crate::{
  bank::{self, QuestionIndex},
  db::DbError,
  import::{self, Catalog, Entry, Plan, Session},
};

/// The open database, or the reason it could not be opened.
pub struct Database(pub Result<Mutex<Connection>, String>);

impl Database {
  fn get(&self) -> Result<MutexGuard<'_, Connection>, String> {
    lock(self.0.as_ref().map_err(Clone::clone)?)
  }
}

/// The import in progress. When both are needed, lock this before the database.
#[derive(Default)]
pub struct CurrentImport(pub Mutex<Session>);

fn lock<T>(mutex: &Mutex<T>) -> Result<MutexGuard<'_, T>, String> {
  mutex.lock().map_err(|_| "Something went wrong. Close LSAT Prep and open it again.".into())
}

fn text(error: impl std::fmt::Display) -> String {
  error.to_string()
}

fn db_text(error: rusqlite::Error) -> String {
  DbError::from(error).to_string()
}

/// Lets the interface show a clear message when saved data is unavailable.
#[tauri::command]
pub fn database_status(database: State<Database>) -> Result<(), String> {
  database
    .get()?
    .query_row("SELECT 1 FROM question_categories LIMIT 1", [], |_| Ok(()))
    .map_err(db_text)
}

#[tauri::command(async)]
pub fn question_index(database: State<Database>) -> Result<QuestionIndex, String> {
  bank::index(&*database.get()?).map_err(db_text)
}

#[tauri::command(async)]
pub fn import_catalog(database: State<Database>) -> Result<Catalog, String> {
  import::load_catalog(&*database.get()?).map_err(db_text)
}

#[tauri::command(async)]
pub fn import_history(database: State<Database>) -> Result<Vec<Entry>, String> {
  import::list_history(&*database.get()?).map_err(db_text)
}

/// Opens the file picker. Returns the file name, or null if the user cancels.
#[tauri::command(async)]
pub fn choose_package<R: Runtime>(
  window: WebviewWindow<R>,
  database: State<Database>,
  current: State<CurrentImport>,
) -> Result<Option<String>, String> {
  let picked = window
    .dialog()
    .file()
    .set_parent(&window)
    .set_title("Choose a question package")
    .add_filter("LSAT Prep question package", &["json"])
    .blocking_pick_file();
  let Some(picked) = picked else {
    return Ok(None);
  };
  let path = picked.into_path().map_err(|_| "The file could not be read.")?;
  lock(&current.0)?.choose(&*database.get()?, &path).map_err(text)?;
  Ok(path.file_name().map(|name| name.to_string_lossy().into_owned()))
}

/// The contents of the chosen file.
#[tauri::command(async)]
pub fn package_bytes(current: State<CurrentImport>) -> Result<Response, String> {
  Ok(Response::new(lock(&current.0)?.bytes().map_err(text)?.to_vec()))
}

#[tauri::command(async)]
pub fn reject_package(
  summary: String,
  database: State<Database>,
  current: State<CurrentImport>,
) -> Result<(), String> {
  lock(&current.0)?.reject(&*database.get()?, &summary).map_err(text)
}

#[tauri::command(async)]
pub fn preview_package(
  database: State<Database>,
  current: State<CurrentImport>,
) -> Result<Plan, String> {
  lock(&current.0)?.preview(&mut *database.get()?).map_err(text)
}

#[tauri::command(async)]
pub fn cancel_import(current: State<CurrentImport>) -> Result<(), String> {
  lock(&current.0)?.cancel();
  Ok(())
}

#[tauri::command(async)]
pub fn confirm_import(
  database: State<Database>,
  current: State<CurrentImport>,
) -> Result<Plan, String> {
  lock(&current.0)?.confirm(&mut *database.get()?).map_err(text)
}

#[cfg(test)]
mod tests {
  use serde_json::{Value, json};
  use tauri::{
    Manager,
    ipc::{CallbackFn, InvokeBody},
    test::{INVOKE_KEY, MockRuntime, get_ipc_response, mock_builder},
    webview::InvokeRequest,
  };

  use super::*;
  use crate::db::{self, test_support::TempDir};

  const VALID: &str = include_str!("../../tests/fixtures/valid-package.json");

  /// The real app setup and permissions, with a simulated window.
  fn app(database: Result<Connection, String>) -> tauri::App<MockRuntime> {
    crate::configure(mock_builder())
      .manage(Database(database.map(Mutex::new)))
      .build(tauri::generate_context!(test = true))
      .unwrap()
  }

  /// Permissions are granted to the window named "main".
  fn window(app: &tauri::App<MockRuntime>) -> WebviewWindow<MockRuntime> {
    tauri::WebviewWindowBuilder::new(app, "main", Default::default()).build().unwrap()
  }

  fn call(window: &WebviewWindow<MockRuntime>, command: &str, body: Value) -> Result<Value, Value> {
    get_ipc_response(
      window,
      InvokeRequest {
        cmd: command.into(),
        callback: CallbackFn(0),
        error: CallbackFn(1),
        url: "tauri://localhost".parse().unwrap(),
        body: InvokeBody::Json(body),
        headers: Default::default(),
        invoke_key: INVOKE_KEY.to_string(),
      },
    )
    .map(|response| match response {
      tauri::ipc::InvokeResponseBody::Json(text) => serde_json::from_str(&text).unwrap(),
      tauri::ipc::InvokeResponseBody::Raw(bytes) => json!(bytes),
    })
  }

  #[test]
  fn the_interface_can_complete_an_import() {
    let dir = TempDir::new();
    let app = app(Ok(db::open(&dir.0).unwrap()));
    let window = window(&app);
    let path = dir.0.join("package.json");
    std::fs::write(&path, VALID).unwrap();
    // Stands in for the file picker.
    app
      .state::<CurrentImport>()
      .0
      .lock()
      .unwrap()
      .choose(&app.state::<Database>().get().unwrap(), &path)
      .unwrap();

    assert_eq!(call(&window, "database_status", json!({})), Ok(Value::Null));
    let catalog = call(&window, "import_catalog", json!({})).unwrap();
    assert_eq!(catalog["categories"].as_array().unwrap().len(), 28);
    let bytes = call(&window, "package_bytes", json!({})).unwrap();
    assert_eq!(bytes, json!(VALID.as_bytes()));
    let plan = call(&window, "preview_package", json!({})).unwrap();
    assert_eq!(plan["questions"]["new"], json!(["test-lr-1", "test-rc-1"]));
    assert_eq!(call(&window, "confirm_import", json!({})).unwrap(), plan);
    let index = call(&window, "question_index", json!({})).unwrap();
    assert_eq!(index["questions"].as_array().unwrap().len(), 2);
    let history = call(&window, "import_history", json!({})).unwrap();
    assert_eq!(history[0]["status"], "succeeded");
    assert!(call(&window, "confirm_import", json!({})).is_err());
    assert_eq!(call(&window, "cancel_import", json!({})), Ok(Value::Null));
    assert!(call(&window, "reject_package", json!({ "summary": "x" })).is_err());
  }

  #[test]
  fn the_interface_has_no_general_file_or_dialog_access() {
    let dir = TempDir::new();
    let app = app(Ok(db::open(&dir.0).unwrap()));
    let window = window(&app);
    for command in ["plugin:dialog|open", "plugin:fs|read_file", "plugin:event|listen"] {
      let error = call(&window, command, json!({})).unwrap_err().to_string();
      assert!(error.contains("not allowed") || error.contains("not found"), "{command}: {error}");
    }
  }

  #[test]
  fn every_command_reports_an_unavailable_database() {
    let app = app(Err("The data file is damaged.".into()));
    let window = window(&app);
    for command in ["database_status", "question_index", "import_catalog", "import_history", "preview_package", "confirm_import"] {
      assert_eq!(call(&window, command, json!({})), Err(json!("The data file is damaged.")));
    }
  }
}
