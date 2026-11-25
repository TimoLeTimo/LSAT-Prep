mod bank;
mod commands;
mod db;
mod import;
mod practice;
mod templates;

use std::sync::Mutex;

use tauri::{Builder, Manager, RunEvent, Runtime};

use commands::{CurrentImport, Database, ExamTimer, SessionClock};

/// Everything the real app and the command tests share.
fn configure<R: Runtime>(builder: Builder<R>) -> Builder<R> {
  builder
    .plugin(tauri_plugin_dialog::init())
    .manage(CurrentImport::default())
    .manage(SessionClock::default())
    .manage(ExamTimer::default())
    .invoke_handler(tauri::generate_handler![
      commands::database_status,
      commands::question_index,
      commands::import_catalog,
      commands::import_history,
      commands::choose_package,
      commands::package_bytes,
      commands::reject_package,
      commands::preview_package,
      commands::cancel_import,
      commands::confirm_import,
      commands::unfinished_session,
      commands::practice_session,
      commands::create_session,
      commands::select_answer,
      commands::flag_question,
      commands::add_question_time,
      commands::set_session_position,
      commands::submit_answer,
      commands::finish_session,
      commands::abandon_session,
      commands::start_clock,
      commands::save_clock,
      commands::pause_clock,
      commands::set_bookmark,
      commands::list_templates,
      commands::create_template,
      commands::update_template,
      commands::rename_template,
      commands::delete_template,
      commands::create_exam,
      commands::unfinished_exam,
      commands::open_exam,
      commands::save_exam,
      commands::leave_exam,
      commands::start_exam_section,
      commands::end_exam_section,
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
    .build(tauri::generate_context!())
    .expect("error while starting LSAT Prep")
    .run(|app, event| {
      if let RunEvent::Exit = event {
        commands::save_clock_before_exit(app);
      }
    });
}
