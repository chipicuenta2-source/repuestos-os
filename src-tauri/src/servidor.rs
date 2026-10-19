// Servidor HTTP integrado (modo "servidor"). Atiende a las PCs cliente de la red local.
// Protocolo: POST /api  con cuerpo {"cmd": "...", "args": {...}} y cabecera X-Token tras iniciar sesión.

use crate::commands::usuarios::UsuarioPublico;
use crate::commands::Ctx;
use crate::{audit, dispatch};
use rusqlite::Connection;
use serde_json::{json, Value};
use std::collections::HashMap;
use std::io::Read;
use std::sync::{Arc, Mutex, MutexGuard};
use tiny_http::{Header, Method, Request, Response, Server};

pub type Db = Arc<Mutex<Connection>>;
pub type Tokens = Arc<Mutex<HashMap<String, UsuarioPublico>>>;

const MAX_CUERPO: u64 = 20 * 1024 * 1024;

pub fn bloquear<T>(m: &Mutex<T>) -> MutexGuard<'_, T> {
    // Si un hilo falló a mitad de camino, seguimos atendiendo en vez de dejar todo bloqueado
    m.lock().unwrap_or_else(|e| e.into_inner())
}

fn nuevo_token() -> String {
    let mut buf = [0u8; 32];
    if getrandom::getrandom(&mut buf).is_err() {
        // Último recurso, no debería ocurrir
        let t = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_nanos())
            .unwrap_or(0);
        return format!("{:x}{:x}", t, std::process::id());
    }
    hex::encode(buf)
}

/// Lógica de un comando recibido por red. Separada del HTTP para poder probarla directamente.
pub fn procesar_remoto(db: &Db, tokens: &Tokens, token: Option<&str>, cmd: &str, args: Value) -> Result<Value, String> {
    match cmd {
        "activar_licencia" => Err("La licencia se activa desde la PC servidor, no desde un cliente.".into()),
        "login" => {
            let mut conn = bloquear(db);
            let v = dispatch::despachar(&mut conn, &Ctx::default(), "login", &args)?;
            drop(conn);
            let usuario: UsuarioPublico = serde_json::from_value(v.clone()).map_err(|e| e.to_string())?;
            let t = nuevo_token();
            bloquear(tokens).insert(t.clone(), usuario);
            let mut obj = v.as_object().cloned().unwrap_or_default();
            obj.insert("token".into(), Value::String(t));
            Ok(Value::Object(obj))
        }
        "logout" => {
            if let Some(t) = token {
                let usuario = bloquear(tokens).remove(t);
                if let Some(u) = usuario {
                    let conn = bloquear(db);
                    audit::registrar(&conn, Some(&u), "logout", "usuario", Some(u.id), "Cerró sesión");
                }
            }
            Ok(Value::Null)
        }
        _ => {
            let usuario = token.and_then(|t| bloquear(tokens).get(t).cloned());
            let mut conn = bloquear(db);
            dispatch::despachar(&mut conn, &Ctx { usuario }, cmd, &args)
        }
    }
}

fn cabecera_json() -> Header {
    Header::from_bytes(&b"Content-Type"[..], &b"application/json; charset=utf-8"[..]).unwrap()
}

fn responder(req: Request, estado: u16, cuerpo: Value) {
    let r = Response::from_string(cuerpo.to_string())
        .with_status_code(estado)
        .with_header(cabecera_json());
    let _ = req.respond(r);
}

fn atender(mut req: Request, db: Db, tokens: Tokens) {
    if req.method() == &Method::Get && req.url() == "/ping" {
        return responder(req, 200, json!({ "ok": true, "data": { "app": "REPUESTOS OS", "version": dispatch::VERSION } }));
    }
    if req.method() != &Method::Post || req.url() != "/api" {
        return responder(req, 404, json!({ "ok": false, "error": "No encontrado" }));
    }

    let token = req
        .headers()
        .iter()
        .find(|h| h.field.equiv("X-Token"))
        .map(|h| h.value.as_str().to_string());

    let mut texto = String::new();
    if req.as_reader().take(MAX_CUERPO).read_to_string(&mut texto).is_err() {
        return responder(req, 400, json!({ "ok": false, "error": "Cuerpo inválido" }));
    }
    let cuerpo: Value = match serde_json::from_str(&texto) {
        Ok(v) => v,
        Err(_) => return responder(req, 400, json!({ "ok": false, "error": "JSON inválido" })),
    };
    let cmd = cuerpo.get("cmd").and_then(|c| c.as_str()).unwrap_or("").to_string();
    let args = cuerpo.get("args").cloned().unwrap_or(Value::Null);

    let resultado = procesar_remoto(&db, &tokens, token.as_deref(), &cmd, args);
    let salida = match resultado {
        Ok(data) => json!({ "ok": true, "data": data }),
        Err(e) => json!({ "ok": false, "error": e }),
    };
    responder(req, 200, salida);
}

/// Arranca el servidor en segundo plano. Devuelve error si el puerto está ocupado.
pub fn iniciar(db: Db, tokens: Tokens, puerto: u16) -> Result<(), String> {
    let servidor = Server::http(("0.0.0.0", puerto))
        .map_err(|e| format!("No se pudo abrir el puerto {} ({}). ¿Hay otra app usándolo?", puerto, e))?;
    std::thread::spawn(move || {
        for req in servidor.incoming_requests() {
            let db = db.clone();
            let tokens = tokens.clone();
            std::thread::spawn(move || atender(req, db, tokens));
        }
    });
    Ok(())
}
