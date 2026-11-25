//! The only operations the interface can ask for. Each also needs permission in
//! capabilities/default.json. `async` keeps slow work from freezing the window.

use std::{
  sync::{Mutex, MutexGuard},
  time::Instant,
};

use rusqlite::Connection;
use tauri::{AppHandle, Manager, Runtime, State, WebviewWindow, ipc::Response};
use tauri_plugin_dialog::DialogExt;

use crate::{
  bank::{self, QuestionIndex},
  db::DbError,
  import::{self, Catalog, Entry, Plan, Session, package::{Label, Section}},
  practice::{self, Clock, Config, Reading},
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

/// The practice clock. When both are needed, lock this before the database.
#[derive(Default)]
pub struct SessionClock(Mutex<Clock>);

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

// ---------------------------------------------------------------- Practice

/// With a null section, finds the unfinished custom session.
#[tauri::command(async)]
pub fn unfinished_session(
  section: Option<Section>,
  database: State<Database>,
) -> Result<Option<practice::Session>, String> {
  practice::unfinished(&*database.get()?, section).map_err(text)
}

#[tauri::command(async)]
pub fn practice_session(
  session_id: String,
  database: State<Database>,
) -> Result<practice::Session, String> {
  practice::load(&*database.get()?, &session_id).map_err(text)
}

#[tauri::command(async)]
pub fn create_session(
  config: Config,
  question_ids: Vec<String>,
  database: State<Database>,
) -> Result<practice::Session, String> {
  practice::create(&mut *database.get()?, &config, &question_ids).map_err(text)
}

#[tauri::command(async)]
pub fn select_answer(
  id: String,
  choice: Option<Label>,
  clock: State<SessionClock>,
  database: State<Database>,
) -> Result<(), String> {
  require_time(&clock, &database, &id)?;
  practice::select(&mut *database.get()?, &id, choice).map_err(text)
}

#[tauri::command(async)]
pub fn flag_question(id: String, flagged: bool, database: State<Database>) -> Result<(), String> {
  practice::set_flag(&mut *database.get()?, &id, flagged).map_err(text)
}

#[tauri::command(async)]
pub fn set_bookmark(
  question_id: String,
  bookmarked: bool,
  database: State<Database>,
) -> Result<(), String> {
  practice::set_bookmark(&mut *database.get()?, &question_id, bookmarked).map_err(text)
}

#[tauri::command(async)]
pub fn add_question_time(
  id: String,
  seconds: i64,
  database: State<Database>,
) -> Result<(), String> {
  practice::add_time(&mut *database.get()?, &id, seconds).map_err(text)
}

#[tauri::command(async)]
pub fn set_session_position(
  session_id: String,
  position: i64,
  database: State<Database>,
) -> Result<(), String> {
  practice::set_position(&mut *database.get()?, &session_id, position).map_err(text)
}

#[tauri::command(async)]
pub fn submit_answer(
  id: String,
  clock: State<SessionClock>,
  database: State<Database>,
) -> Result<practice::Session, String> {
  require_time(&clock, &database, &id)?;
  practice::submit(&mut *database.get()?, &id).map_err(text)
}

#[tauri::command(async)]
pub fn finish_session(
  session_id: String,
  clock: State<SessionClock>,
  database: State<Database>,
) -> Result<practice::Session, String> {
  let mut clock = lock(&clock.0)?;
  let mut conn = database.get()?;
  let reading = clock.pause(&mut conn, &session_id, Instant::now()).map_err(text)?;
  match reading.ended {
    // Time ran out just before, or it was already finished.
    Some(session) => Ok(session),
    None => practice::finish(&mut conn, &session_id).map_err(text),
  }
}

#[tauri::command(async)]
pub fn start_clock(
  session_id: String,
  clock: State<SessionClock>,
  database: State<Database>,
) -> Result<Reading, String> {
  lock(&clock.0)?.start(&mut *database.get()?, &session_id, Instant::now()).map_err(text)
}

#[tauri::command(async)]
pub fn save_clock(
  session_id: String,
  clock: State<SessionClock>,
  database: State<Database>,
) -> Result<Reading, String> {
  lock(&clock.0)?.save(&mut *database.get()?, &session_id, Instant::now()).map_err(text)
}

#[tauri::command(async)]
pub fn pause_clock(
  session_id: String,
  clock: State<SessionClock>,
  database: State<Database>,
) -> Result<Reading, String> {
  lock(&clock.0)?.pause(&mut *database.get()?, &session_id, Instant::now()).map_err(text)
}

/// Refuses an answer when time is up or the timer is paused.
fn require_time(clock: &SessionClock, database: &Database, question: &str) -> Result<(), String> {
  let mut clock = lock(&clock.0)?;
  let mut conn = database.get()?;
  let session_id = practice::session_of(&conn, question).map_err(text)?;
  clock.require_time(&mut conn, &session_id, Instant::now()).map_err(text)
}

/// A normal close loses no clock time. Failure only loses time since the last save.
pub fn save_clock_before_exit<R: Runtime>(app: &AppHandle<R>) {
  let (clock, database) = (app.state::<SessionClock>(), app.state::<Database>());
  if let (Ok(mut clock), Ok(mut conn)) = (lock(&clock.0), database.get()) {
    let _ = clock.pause_any(&mut conn, Instant::now());
  }
}

#[tauri::command(async)]
pub fn abandon_session(session_id: String, database: State<Database>) -> Result<(), String> {
  practice::abandon(&mut *database.get()?, &session_id).map_err(text)
}

#[cfg(test)]
mod tests {
  use serde_json::{Value, json};
  use tauri::{
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
  fn the_interface_can_complete_a_practice_session() {
    let dir = TempDir::new();
    let mut conn = db::open(&dir.0).unwrap();
    let path = dir.0.join("package.json");
    std::fs::write(&path, VALID).unwrap();
    let mut import = Session::default();
    import.choose(&conn, &path).unwrap();
    import.preview(&mut conn).unwrap();
    import.confirm(&mut conn).unwrap();
    let app = app(Ok(conn));
    let window = window(&app);
    let call = |command: &str, body: Value| call(&window, command, body);
    let section = json!({ "section": "logical_reasoning" });

    assert_eq!(call("unfinished_session", section.clone()), Ok(Value::Null));
    let config = json!({
      "section": "logical_reasoning", "category_ids": [], "difficulties": [2],
      "question_count": 1, "explanations": "after_each"
    });
    let body = json!({ "config": config, "questionIds": ["test-lr-1"] });
    let session = call("create_session", body).unwrap();
    let (id, question) = (&session["id"], &session["questions"][0]["id"]);
    assert_eq!(session["questions"][0]["outcome"], Value::Null);

    assert!(call("select_answer", json!({ "id": question, "choice": "F" })).is_err());
    for (command, body) in [
      ("select_answer", json!({ "id": question, "choice": "C" })),
      ("flag_question", json!({ "id": question, "flagged": true })),
      ("set_bookmark", json!({ "questionId": "test-lr-1", "bookmarked": true })),
      ("add_question_time", json!({ "id": question, "seconds": 5 })),
      ("set_session_position", json!({ "sessionId": id, "position": 0 })),
    ] {
      assert_eq!(call(command, body), Ok(Value::Null), "{command}");
    }
    let resumed = call("unfinished_session", section.clone()).unwrap();
    assert_eq!(resumed["questions"][0]["selected"], "C");
    assert_eq!(resumed["questions"][0]["is_bookmarked"], true);
    let checked = call("submit_answer", json!({ "id": question })).unwrap();
    assert_eq!(checked["questions"][0]["outcome"]["is_correct"], true);
    let done = call("finish_session", json!({ "sessionId": id })).unwrap();
    assert_eq!(call("practice_session", json!({ "sessionId": id })), Ok(done));
    assert_eq!(call("unfinished_session", section), Ok(Value::Null));
    let ended = call("abandon_session", json!({ "sessionId": id }));
    assert_eq!(ended, Err(json!("This practice session has ended.")));
  }

  #[test]
  fn timed_answers_need_a_running_clock() {
    let dir = TempDir::new();
    let mut conn = db::open(&dir.0).unwrap();
    let path = dir.0.join("package.json");
    std::fs::write(&path, VALID).unwrap();
    let mut import = Session::default();
    import.choose(&conn, &path).unwrap();
    import.preview(&mut conn).unwrap();
    import.confirm(&mut conn).unwrap();
    let app = app(Ok(conn));
    let window = window(&app);
    let call = |command: &str, body: Value| call(&window, command, body);
    let config = json!({
      "section": "logical_reasoning", "category_ids": [], "difficulties": [],
      "question_count": 1, "explanations": "after_each", "time_limit_seconds": 60
    });
    let session =
      call("create_session", json!({ "config": config, "questionIds": ["test-lr-1"] })).unwrap();
    let id = json!({ "sessionId": session["id"] });
    let answer = json!({ "id": session["questions"][0]["id"], "choice": "C" });

    assert!(call("select_answer", answer.clone()).unwrap_err().to_string().contains("paused"));
    assert_eq!(call("start_clock", id.clone()).unwrap()["remaining_ms"], 60_000);
    assert_eq!(call("select_answer", answer.clone()), Ok(Value::Null));
    assert_eq!(call("save_clock", id.clone()).unwrap()["ended"], Value::Null);
    call("pause_clock", id.clone()).unwrap();
    assert!(call("select_answer", answer.clone()).is_err());
    assert!(call("submit_answer", json!({ "id": answer["id"] })).is_err());

    // Closing the app saves a running clock, after which it is paused.
    call("start_clock", id.clone()).unwrap();
    save_clock_before_exit(app.handle());
    assert!(call("select_answer", answer).unwrap_err().to_string().contains("paused"));
    let done = call("finish_session", id.clone()).unwrap();
    assert_eq!(done["questions"][0]["outcome"]["is_correct"], true);
    assert_eq!(call("save_clock", id).unwrap()["ended"], done);
  }

  #[test]
  fn the_interface_can_start_a_passage_set() {
    let dir = TempDir::new();
    let mut conn = db::open(&dir.0).unwrap();
    let path = dir.0.join("package.json");
    std::fs::write(&path, VALID).unwrap();
    let mut import = Session::default();
    import.choose(&conn, &path).unwrap();
    import.preview(&mut conn).unwrap();
    import.confirm(&mut conn).unwrap();
    let app = app(Ok(conn));
    let window = window(&app);
    let config = json!({
      "section": "reading_comprehension", "category_ids": [], "difficulties": [],
      "question_count": 1, "explanations": "at_end", "passage_count": 1, "time_limit_seconds": null
    });
    let body = json!({ "config": config, "questionIds": ["test-rc-1"] });
    let session = call(&window, "create_session", body).unwrap();
    let passage = &session["questions"][0]["passage"];
    assert_eq!(passage["id"], "test-passage-1");
    assert_eq!(passage["texts"].as_array().unwrap().len(), 2);
    let section = json!({ "section": "reading_comprehension" });
    assert_eq!(call(&window, "unfinished_session", section), Ok(session));
  }

  #[test]
  fn the_interface_can_complete_a_custom_session() {
    let dir = TempDir::new();
    let mut conn = db::open(&dir.0).unwrap();
    let path = dir.0.join("package.json");
    std::fs::write(&path, VALID).unwrap();
    let mut import = Session::default();
    import.choose(&conn, &path).unwrap();
    import.preview(&mut conn).unwrap();
    import.confirm(&mut conn).unwrap();
    let app = app(Ok(conn));
    let window = window(&app);
    let call = |command: &str, body: Value| call(&window, command, body);
    let config = json!({
      "section": null, "category_ids": [], "difficulties": [], "question_count": 2,
      "explanations": "at_end", "passage_count": 1, "time_limit_seconds": null,
      "custom": { "lr_count": 1, "subset": "new", "exclude_correct": true,
        "shuffle_questions": true, "shuffle_answers": true }
    });
    let body = json!({ "config": config, "questionIds": ["test-lr-1", "test-rc-1"] });
    let session = call("create_session", body.clone()).unwrap();
    assert_eq!(call("unfinished_session", json!({ "section": null })), Ok(session.clone()));
    let lr = call("unfinished_session", json!({ "section": "logical_reasoning" }));
    assert_eq!(lr, Ok(Value::Null));
    let question = &session["questions"][0];
    let correct = question["choices"].as_array().unwrap().iter()
      .find(|choice| choice["text"] == "Test choice C").unwrap();
    let answer = json!({ "id": question["id"], "choice": correct["label"] });
    call("select_answer", answer).unwrap();
    let done = call("finish_session", json!({ "sessionId": session["id"] })).unwrap();
    assert_eq!(done["questions"][0]["outcome"]["is_correct"], true);
    let index = call("question_index", json!({})).unwrap();
    assert_eq!(index["questions"][0]["last_correct"], true);
    // No longer new.
    assert!(call("create_session", body).is_err());
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
