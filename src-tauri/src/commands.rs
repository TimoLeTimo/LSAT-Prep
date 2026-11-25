//! The only operations the interface can ask for. Each also needs permission in
//! capabilities/default.json. `async` keeps slow work from freezing the window.

use std::{
  fs::File,
  ops::{Deref, DerefMut},
  path::{Path, PathBuf},
  sync::{Mutex, MutexGuard},
  time::Instant,
};

use rusqlite::Connection;
use tauri::{AppHandle, Manager, Runtime, State, WebviewWindow, ipc::Response};
use tauri_plugin_dialog::DialogExt;

use crate::{
  bank::{self, QuestionIndex},
  db::{self, DbError, backup::{self, Summary}},
  import::{self, Catalog, Entry, Plan, Session, package::{Label, Section}},
  practice::{
    self, Clock, Config, ExamKind, Reading,
    exam::{self, Exam, ExamClock, NewSection, Now},
  },
  templates::{self, Choices, Template},
};

enum Store {
  Open(Connection),
  /// Why it could not be opened, and whether a backup could take its place.
  Failed { message: String, can_restore: bool },
}

/// The database, and the lock that keeps other copies of the app away from it.
pub struct Database {
  state: Mutex<Store>,
  dir: Option<PathBuf>,
  _lock: Option<File>,
}

/// The open database, locked for one command.
pub struct OpenDatabase<'a>(MutexGuard<'a, Store>);

impl Deref for OpenDatabase<'_> {
  type Target = Connection;
  fn deref(&self) -> &Connection {
    match &*self.0 {
      Store::Open(conn) => conn,
      Store::Failed { .. } => unreachable!("only built for an open database"),
    }
  }
}

impl DerefMut for OpenDatabase<'_> {
  fn deref_mut(&mut self) -> &mut Connection {
    match &mut *self.0 {
      Store::Open(conn) => conn,
      Store::Failed { .. } => unreachable!("only built for an open database"),
    }
  }
}

impl Database {
  pub fn open(dir: &Path) -> Self {
    let dir = Some(dir.to_owned());
    let folder = dir.as_deref().expect("just set");
    let lock = match db::lock(folder) {
      Ok(lock) => lock,
      // The data may be fine and in use, so nothing here may touch it.
      Err(error) => return Self::failed(error.to_string()),
    };
    backup::clear_staging(folder);
    let state = match db::open(folder) {
      Ok(conn) => Store::Open(conn),
      Err(error) => Store::Failed { message: error.to_string(), can_restore: true },
    };
    Database { state: Mutex::new(state), dir, _lock: Some(lock) }
  }

  pub fn failed(message: String) -> Self {
    let state = Mutex::new(Store::Failed { message, can_restore: false });
    Database { state, dir: None, _lock: None }
  }

  fn get(&self) -> Result<OpenDatabase<'_>, String> {
    let state = lock(&self.state)?;
    match &*state {
      Store::Open(_) => Ok(OpenDatabase(state)),
      Store::Failed { message, .. } => Err(message.clone()),
    }
  }

  fn dir(&self) -> Result<&Path, String> {
    self.dir.as_deref().ok_or_else(|| "The data folder is not available.".into())
  }

  /// Replaces the data with the chosen backup. Returns what the old data was saved as.
  fn restore(&self) -> Result<String, String> {
    let dir = self.dir()?;
    let mut state = lock(&self.state)?;
    match &mut *state {
      Store::Open(conn) => backup::restore(conn, dir).map_err(|error| backup::explain(&error)),
      Store::Failed { can_restore: true, .. } => {
        let (conn, name) =
          backup::restore_over_unreadable(dir).map_err(|error| backup::explain(&error))?;
        *state = Store::Open(conn);
        Ok(name)
      }
      Store::Failed { message, .. } => Err(message.clone()),
    }
  }
}

/// The import in progress. When both are needed, lock this before the database.
#[derive(Default)]
pub struct CurrentImport(pub Mutex<Session>);

/// The practice clock. When both are needed, lock this before the database.
#[derive(Default)]
pub struct SessionClock(Mutex<Clock>);

/// The exam clock. When both are needed, lock this before the database.
#[derive(Default)]
pub struct ExamTimer(Mutex<ExamClock>);

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
  exam: State<ExamTimer>,
  database: State<Database>,
) -> Result<(), String> {
  require_time(&clock, &exam, &database, &id)?;
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
  exam: State<ExamTimer>,
  database: State<Database>,
) -> Result<practice::Session, String> {
  require_time(&clock, &exam, &database, &id)?;
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

// ---------------------------------------------------------------- Exams

#[tauri::command(async)]
pub fn create_exam(
  kind: ExamKind,
  name: String,
  sections: Vec<NewSection>,
  exam: State<ExamTimer>,
  database: State<Database>,
) -> Result<Exam, String> {
  let mut exam = lock(&exam.0)?;
  let mut conn = database.get()?;
  let id = exam::create(&mut conn, kind, &name, &sections).map_err(text)?;
  exam.save(&mut conn, &id, Now::get()).map_err(text)
}

#[tauri::command(async)]
pub fn unfinished_exam(
  exam: State<ExamTimer>,
  database: State<Database>,
) -> Result<Option<Exam>, String> {
  lock(&exam.0)?.unfinished(&mut *database.get()?, Now::get()).map_err(text)
}

#[tauri::command(async)]
pub fn latest_exam(database: State<Database>) -> Result<Option<Exam>, String> {
  exam::latest(&*database.get()?, Now::get()).map_err(text)
}

#[tauri::command(async)]
pub fn open_exam(
  session_id: String,
  exam: State<ExamTimer>,
  database: State<Database>,
) -> Result<Exam, String> {
  lock(&exam.0)?.open(&mut *database.get()?, &session_id, Now::get()).map_err(text)
}

#[tauri::command(async)]
pub fn save_exam(
  session_id: String,
  exam: State<ExamTimer>,
  database: State<Database>,
) -> Result<Exam, String> {
  lock(&exam.0)?.save(&mut *database.get()?, &session_id, Now::get()).map_err(text)
}

#[tauri::command(async)]
pub fn leave_exam(
  session_id: String,
  exam: State<ExamTimer>,
  database: State<Database>,
) -> Result<(), String> {
  lock(&exam.0)?.leave(&mut *database.get()?, &session_id, Now::get()).map_err(text)
}

#[tauri::command(async)]
pub fn start_exam_section(
  session_id: String,
  exam: State<ExamTimer>,
  database: State<Database>,
) -> Result<Exam, String> {
  lock(&exam.0)?.start_section(&mut *database.get()?, &session_id, Now::get()).map_err(text)
}

#[tauri::command(async)]
pub fn end_exam_section(
  session_id: String,
  position: i64,
  exam: State<ExamTimer>,
  database: State<Database>,
) -> Result<Exam, String> {
  let mut exam = lock(&exam.0)?;
  exam.end_section(&mut *database.get()?, &session_id, position, Now::get()).map_err(text)
}

// ---------------------------------------------------------------- Backup and restore

#[tauri::command(async)]
pub fn data_summary(database: State<Database>) -> Result<Summary, String> {
  backup::summary(&*database.get()?).map_err(text)
}

/// Whether a backup can be restored, including when the current data cannot be opened.
#[tauri::command]
pub fn can_restore(database: State<Database>) -> Result<bool, String> {
  Ok(match &*lock(&database.state)? {
    Store::Open(_) => true,
    Store::Failed { can_restore, .. } => *can_restore,
  })
}

/// Asks where to save, then saves a backup there. Returns its name, or null if cancelled.
#[tauri::command(async)]
pub fn back_up_data<R: Runtime>(
  window: WebviewWindow<R>,
  database: State<Database>,
) -> Result<Option<String>, String> {
  let today: String = database
    .get()?
    .query_row("SELECT date('now', 'localtime')", [], |row| row.get(0))
    .map_err(db_text)?;
  let picked = window
    .dialog()
    .file()
    .set_parent(&window)
    .set_title("Save a backup")
    .set_file_name(format!("lsat-prep-backup-{today}.db"))
    .add_filter("LSAT Prep backup", &["db"])
    .blocking_save_file();
  let Some(picked) = picked else {
    return Ok(None);
  };
  let path = picked.into_path().map_err(|_| "The backup could not be saved there.")?;
  save_backup(&database, &path).map(Some)
}

fn save_backup(database: &Database, path: &Path) -> Result<String, String> {
  let dir = database.dir()?;
  backup::export(&*database.get()?, dir, path).map_err(|error| backup::explain_save(&error))?;
  Ok(path.file_name().map(|name| name.to_string_lossy().into_owned()).unwrap_or_default())
}

#[derive(serde::Serialize)]
pub struct ChosenBackup {
  name: String,
  /// Milliseconds since 1970, or null if unknown.
  modified_ms: Option<i64>,
  summary: Summary,
}

/// Asks for a backup and checks it. Changes nothing. Returns null if cancelled.
#[tauri::command(async)]
pub fn choose_backup<R: Runtime>(
  window: WebviewWindow<R>,
  database: State<Database>,
) -> Result<Option<ChosenBackup>, String> {
  let mut dialog = window
    .dialog()
    .file()
    .set_parent(&window)
    .set_title("Choose a backup")
    .add_filter("LSAT Prep backup", &["db"]);
  // Automatic backups are here.
  let automatic = database.dir()?.join("backups");
  if automatic.is_dir() {
    dialog = dialog.set_directory(automatic);
  }
  let Some(picked) = dialog.blocking_pick_file() else {
    return Ok(None);
  };
  let path = picked.into_path().map_err(|_| "The file could not be read.")?;
  check_backup(&database, &path).map(Some)
}

fn check_backup(database: &Database, path: &Path) -> Result<ChosenBackup, String> {
  // Held so that nothing is restored while the copy is being checked.
  let _state = lock(&database.state)?;
  let summary =
    backup::stage(database.dir()?, path).map_err(|error| backup::explain(&error))?;
  let modified_ms = std::fs::metadata(path)
    .and_then(|info| info.modified())
    .ok()
    .and_then(|time| time.duration_since(std::time::UNIX_EPOCH).ok())
    .map(|time| time.as_millis() as i64);
  let name = path.file_name().map(|name| name.to_string_lossy().into_owned()).unwrap_or_default();
  Ok(ChosenBackup { name, modified_ms, summary })
}

#[tauri::command(async)]
pub fn cancel_restore(database: State<Database>) -> Result<(), String> {
  let _state = lock(&database.state)?;
  backup::clear_staging(database.dir()?);
  Ok(())
}

/// Replaces the current data. Returns what the replaced data was saved as.
#[tauri::command(async)]
pub fn confirm_restore(
  clock: State<SessionClock>,
  exam: State<ExamTimer>,
  import: State<CurrentImport>,
  database: State<Database>,
) -> Result<String, String> {
  // Nothing in progress may carry over to the restored data.
  let mut clock = lock(&clock.0)?;
  let mut exam = lock(&exam.0)?;
  let mut import = lock(&import.0)?;
  if let Ok(mut conn) = database.get() {
    let _ = clock.pause_any(&mut conn, Instant::now());
    let _ = exam.leave_any(&mut conn, Now::get());
  }
  *clock = Clock::default();
  *exam = ExamClock::default();
  import.cancel();
  database.restore()
}

// ---------------------------------------------------------------- Templates

#[tauri::command(async)]
pub fn list_templates(database: State<Database>) -> Result<Vec<Template>, String> {
  templates::list(&*database.get()?).map_err(text)
}

#[tauri::command(async)]
pub fn create_template(
  name: String,
  choices: Choices,
  database: State<Database>,
) -> Result<(), String> {
  templates::create(&mut *database.get()?, &name, &choices).map_err(text)
}

#[tauri::command(async)]
pub fn update_template(
  id: String,
  choices: Choices,
  database: State<Database>,
) -> Result<(), String> {
  templates::update(&mut *database.get()?, &id, &choices).map_err(text)
}

#[tauri::command(async)]
pub fn rename_template(id: String, name: String, database: State<Database>) -> Result<(), String> {
  templates::rename(&mut *database.get()?, &id, &name).map_err(text)
}

#[tauri::command(async)]
pub fn delete_template(id: String, database: State<Database>) -> Result<(), String> {
  templates::delete(&mut *database.get()?, &id).map_err(text)
}

/// Refuses an answer when time is up or the timer is paused.
fn require_time(
  clock: &SessionClock,
  exam: &ExamTimer,
  database: &Database,
  question: &str,
) -> Result<(), String> {
  let in_exam = practice::is_exam_question(&*database.get()?, question).map_err(text)?;
  if in_exam {
    let mut exam = lock(&exam.0)?;
    return exam.require_time(&mut *database.get()?, question, Now::get()).map_err(text);
  }
  let mut clock = lock(&clock.0)?;
  let mut conn = database.get()?;
  let session_id = practice::session_of(&conn, question).map_err(text)?;
  clock.require_time(&mut conn, &session_id, Instant::now()).map_err(text)
}

/// A normal close loses no clock time, and leaves the data in one complete file. Failure
/// only loses time since the last save.
pub fn save_before_exit<R: Runtime>(app: &AppHandle<R>) {
  let (clock, database) = (app.state::<SessionClock>(), app.state::<Database>());
  if let (Ok(mut clock), Ok(mut conn)) = (lock(&clock.0), database.get()) {
    let _ = clock.pause_any(&mut conn, Instant::now());
  }
  let exam = app.state::<ExamTimer>();
  if let (Ok(mut exam), Ok(mut conn)) = (lock(&exam.0), database.get()) {
    let _ = exam.leave_any(&mut conn, Now::get());
    let _ = db::tidy(&conn);
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
    Manager,
    ipc::{CallbackFn, InvokeBody},
    test::{INVOKE_KEY, MockRuntime, get_ipc_response, mock_builder},
    webview::InvokeRequest,
  };

  use super::*;
  use crate::db::test_support::TempDir;

  const VALID: &str = include_str!("../../tests/fixtures/valid-package.json");

  /// The real app setup and permissions, with a simulated window.
  fn app(database: Result<Connection, String>) -> tauri::App<MockRuntime> {
    crate::configure(mock_builder())
      .manage(match database {
        Ok(conn) => Database { state: Mutex::new(Store::Open(conn)), dir: None, _lock: None },
        Err(message) => Database::failed(message),
      })
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
    save_before_exit(app.handle());
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
  fn the_interface_can_manage_templates() {
    let dir = TempDir::new();
    let app = app(Ok(db::open(&dir.0).unwrap()));
    let window = window(&app);
    let call = |command: &str, body: Value| call(&window, command, body);
    let choices = json!({
      "categories": [{ "id": "lr-flaw", "section": "logical_reasoning", "name": "Flaw" }],
      "difficulties": [], "lr_count": 5, "passage_count": 0, "subset": "any",
      "exclude_correct": false, "shuffle_questions": false, "shuffle_answers": false,
      "explanations": "after_each", "time_limit_seconds": null
    });
    let first = json!({ "name": "One", "choices": choices });
    assert_eq!(call("create_template", first.clone()), Ok(Value::Null));
    assert!(call("create_template", first).is_err());
    let list = call("list_templates", json!({})).unwrap();
    assert_eq!(list[0]["choices"], choices);
    let id = &list[0]["id"];
    call("update_template", json!({ "id": id, "choices": choices })).unwrap();
    call("rename_template", json!({ "id": id, "name": "Two" })).unwrap();
    assert_eq!(call("list_templates", json!({})).unwrap()[0]["name"], "Two");
    call("delete_template", json!({ "id": id })).unwrap();
    assert_eq!(call("list_templates", json!({})), Ok(json!([])));
  }

  #[test]
  fn the_interface_can_complete_an_exam() {
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
    let section = |kind: &str, id: &str, rest: i64, unscored: Value| {
      json!({ "section": kind, "time_limit_seconds": 60, "break_after_seconds": rest,
        "question_ids": [id], "unscored_ids": unscored })
    };
    let body = json!({ "kind": "test", "name": "Mini", "sections": [
      section("logical_reasoning", "test-lr-1", 60, json!([])),
      section("reading_comprehension", "test-rc-1", 0, json!(["test-rc-1"])),
    ]});
    let exam = call("create_exam", body.clone()).unwrap();
    assert!(call("create_exam", body).is_err());
    assert_eq!(exam["phase"], json!({ "name": "ready", "position": 0 }));
    assert_eq!(exam["session"]["questions"], json!([]));
    let id = json!({ "sessionId": exam["session"]["id"] });
    let first = call("start_exam_section", id.clone()).unwrap();
    let question = first["session"]["questions"][0]["id"].clone();
    let answer = json!({ "id": question, "choice": "C" });
    call("select_answer", answer.clone()).unwrap();
    call("flag_question", json!({ "id": question, "flagged": true })).unwrap();
    // Practice commands cannot get around the exam's rules.
    assert!(call("submit_answer", json!({ "id": question })).is_err());
    assert!(call("finish_session", id.clone()).is_err());
    assert!(call("start_clock", id.clone()).is_err());
    let hidden = call("practice_session", id.clone()).unwrap().to_string();
    assert!(!hidden.contains("test-rc-1") && !hidden.contains("correct_choice\":"));

    call("leave_exam", id.clone()).unwrap();
    assert!(call("select_answer", answer.clone()).unwrap_err().to_string().contains("paused"));
    assert_eq!(call("unfinished_exam", json!({})).unwrap()["phase"]["name"], "section");
    call("open_exam", id.clone()).unwrap();
    call("select_answer", answer.clone()).unwrap();
    let mut end = id.clone();
    end["position"] = json!(0);
    assert_eq!(call("end_exam_section", end.clone()).unwrap()["phase"]["name"], "break");
    assert!(call("select_answer", answer).is_err());
    call("start_exam_section", id.clone()).unwrap();
    assert_eq!(call("save_exam", id.clone()).unwrap()["phase"]["name"], "section");
    end["position"] = json!(1);
    let done = call("end_exam_section", end).unwrap();
    assert_eq!(done["phase"]["name"], "ended");
    let questions = &done["session"]["questions"];
    assert_eq!(questions[0]["outcome"]["is_correct"], true);
    assert_eq!((&questions[0]["is_scored"], &questions[1]["is_scored"]), (&json!(true), &json!(false)));
    assert_eq!(call("unfinished_exam", json!({})), Ok(Value::Null));
    assert_eq!(call("latest_exam", json!({})), Ok(done));
  }

  /// An app whose data is in this folder, opened as it really is.
  fn app_in(dir: &TempDir) -> tauri::App<MockRuntime> {
    crate::configure(mock_builder())
      .manage(Database::open(&dir.0))
      .build(tauri::generate_context!(test = true))
      .unwrap()
  }

  #[test]
  fn the_interface_can_back_up_and_restore() {
    let (dir, elsewhere) = (TempDir::new(), TempDir::new());
    let app = app_in(&dir);
    let window = window(&app);
    let call = |command: &str, body: Value| call(&window, command, body);
    let database = app.state::<Database>();
    let file = elsewhere.0.join("mine.db");
    assert_eq!(save_backup(&database, &file), Ok("mine.db".into()));
    let missing = save_backup(&database, &elsewhere.0.join("missing").join("x.db"));
    assert!(missing.unwrap_err().contains("could not be saved there"));
    let choices = json!({
      "categories": [], "difficulties": [], "lr_count": 5, "passage_count": 0, "subset": "any",
      "exclude_correct": false, "shuffle_questions": false, "shuffle_answers": false,
      "explanations": "after_each", "time_limit_seconds": null
    });
    call("create_template", json!({ "name": "One", "choices": choices })).unwrap();
    assert_eq!(call("data_summary", json!({})).unwrap()["templates"], 1);
    assert_eq!(call("can_restore", json!({})), Ok(json!(true)));
    assert!(call("confirm_restore", json!({})).is_err(), "nothing was chosen");

    let chosen = check_backup(&database, &file).unwrap_or_else(|error| panic!("{error}"));
    assert_eq!((chosen.name.as_str(), chosen.summary.templates), ("mine.db", 0));
    assert!(chosen.modified_ms.is_some());
    call("cancel_restore", json!({})).unwrap();
    assert!(call("confirm_restore", json!({})).is_err(), "it was cancelled");
    check_backup(&database, &file).unwrap_or_else(|error| panic!("{error}"));
    let saved = call("confirm_restore", json!({})).unwrap();
    assert!(saved.as_str().unwrap().starts_with("before-restore-"));
    assert_eq!(call("data_summary", json!({})).unwrap()["templates"], 0);
    assert!(call("confirm_restore", json!({})).is_err(), "only once");
  }

  #[test]
  fn the_interface_can_restore_over_unreadable_data() {
    let (dir, elsewhere) = (TempDir::new(), TempDir::new());
    let file = elsewhere.0.join("mine.db");
    let conn = db::open(&dir.0).unwrap();
    backup::export(&conn, &dir.0, &file).unwrap();
    drop(conn);
    std::fs::write(dir.0.join("lsat-prep.db"), "ruined ".repeat(2000)).unwrap();
    let app = app_in(&dir);
    let window = window(&app);
    let call = |command: &str, body: Value| call(&window, command, body);
    assert!(call("database_status", json!({})).is_err());
    assert!(call("data_summary", json!({})).is_err());
    assert_eq!(call("can_restore", json!({})), Ok(json!(true)));
    check_backup(&app.state::<Database>(), &file).unwrap_or_else(|error| panic!("{error}"));
    assert!(call("confirm_restore", json!({})).unwrap().as_str().unwrap().starts_with("unreadable-"));
    assert_eq!(call("database_status", json!({})), Ok(Value::Null));
  }

  #[test]
  fn a_second_copy_cannot_touch_the_data() {
    let dir = TempDir::new();
    let _first = app_in(&dir);
    let second = app_in(&dir);
    let window = window(&second);
    let call = |command: &str| call(&window, command, json!({}));
    assert!(call("database_status").unwrap_err().to_string().contains("already open"));
    assert_eq!(call("can_restore"), Ok(json!(false)));
    for command in ["confirm_restore", "cancel_restore", "data_summary", "import_history"] {
      assert!(call(command).is_err(), "{command}");
    }
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
