// Cliente HTTP: reenvía un comando a la PC servidor. Se hace desde Rust (no desde la ventana web)
// para no depender de CORS ni de las restricciones de red del WebView en Mac.

use serde_json::{json, Value};
use std::time::Duration;

const MSG_SIN_CONEXION: &str = "No se pudo conectar con la PC servidor. Revisa que esté encendida, con la app abierta en modo Servidor, y que ambas estén en la misma red.";

pub fn llamar(base: &str, token: Option<&str>, cmd: &str, args: &Value) -> Result<Value, String> {
    let agente = ureq::AgentBuilder::new()
        .timeout_connect(Duration::from_secs(4))
        .timeout(Duration::from_secs(30))
        .build();
    let mut peticion = agente.post(&format!("{}/api", base));
    if let Some(t) = token {
        peticion = peticion.set("X-Token", t);
    }
    let respuesta = peticion
        .send_json(json!({ "cmd": cmd, "args": args }))
        .map_err(|e| match e {
            ureq::Error::Status(codigo, _) => format!("El servidor respondió con un error ({})", codigo),
            ureq::Error::Transport(_) => MSG_SIN_CONEXION.to_string(),
        })?;
    let cuerpo: Value = respuesta
        .into_json()
        .map_err(|_| "Respuesta inválida del servidor (¿es la dirección correcta?)".to_string())?;
    if cuerpo.get("ok").and_then(|v| v.as_bool()) == Some(true) {
        Ok(cuerpo.get("data").cloned().unwrap_or(Value::Null))
    } else {
        Err(cuerpo
            .get("error")
            .and_then(|v| v.as_str())
            .unwrap_or("Error desconocido del servidor")
            .to_string())
    }
}
