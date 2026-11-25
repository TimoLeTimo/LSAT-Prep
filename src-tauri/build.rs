fn main() {
  // Listing commands here makes each one need explicit permission in capabilities/.
  let commands = tauri_build::AppManifest::new().commands(&[
    "database_status",
    "question_index",
    "import_catalog",
    "import_history",
    "choose_package",
    "package_bytes",
    "reject_package",
    "preview_package",
    "cancel_import",
    "confirm_import",
    "unfinished_session",
    "practice_session",
    "create_session",
    "select_answer",
    "flag_question",
    "add_question_time",
    "set_session_position",
    "submit_answer",
    "finish_session",
    "abandon_session",
    "start_clock",
    "save_clock",
    "pause_clock",
  ]);
  tauri_build::try_build(tauri_build::Attributes::new().app_manifest(commands))
    .expect("failed to prepare the Tauri build");
}
