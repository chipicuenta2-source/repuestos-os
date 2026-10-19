// Previene que se abra una consola extra en Windows en modo release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod audit;
mod cliente;
mod commands;
mod config;
mod db;
mod dispatch;
mod licencia;
mod nucleo;
mod servidor;

use nucleo::AppState;
use tauri::{Manager, State};

/// Único comando que usa la ventana: recibe el nombre del comando y sus argumentos en JSON.
/// (async para que las llamadas por red no congelen la interfaz)
#[tauri::command]
async fn ejecutar(
    state: State<'_, AppState>,
    cmd: String,
    args: serde_json::Value,
) -> Result<serde_json::Value, String> {
    nucleo::ejecutar(&state, &cmd, args)
}

#[tauri::command]
fn reiniciar_app(app: tauri::AppHandle) {
    app.restart();
}

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            let dir = app
                .path()
                .app_data_dir()
                .map_err(|e| format!("No se pudo resolver el directorio de datos: {}", e))?;
            let estado = AppState::nuevo(dir)?;
            app.manage(estado);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![ejecutar, reiniciar_app])
        .run(tauri::generate_context!())
        .expect("error corriendo la aplicación Tauri");
}
