fn main() {
  // Listing commands here makes each one need explicit permission in capabilities/.
  let commands = tauri_build::AppManifest::new().commands(&["database_status"]);
  tauri_build::try_build(tauri_build::Attributes::new().app_manifest(commands))
    .expect("failed to prepare the Tauri build");
}
