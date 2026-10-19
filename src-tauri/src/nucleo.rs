// Estado de la aplicación y punto de entrada único para todos los comandos de la ventana.
// Según el modo de red, el comando se ejecuta aquí mismo o se reenvía a la PC servidor.

use crate::commands::usuarios::UsuarioPublico;
use crate::commands::Ctx;
use crate::config::{self, Config};
use crate::servidor::{bloquear, Db, Tokens};
use crate::{audit, cliente, db, dispatch, licencia, servidor};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};

pub struct AppState {
    pub db: Db,
    pub tokens: Tokens,
    pub local_user: Mutex<Option<UsuarioPublico>>,
    pub client_token: Mutex<Option<String>>,
    pub config: Mutex<Config>,
    pub data_dir: PathBuf,
    pub error_servidor: Mutex<Option<String>>,
}

impl AppState {
    pub fn nuevo(data_dir: PathBuf) -> Result<AppState, String> {
        let conn = db::conectar(data_dir.clone()).map_err(|e| format!("No se pudo abrir la base de datos: {}", e))?;
        db::init_db(&conn).map_err(|e| format!("No se pudo inicializar la base de datos: {}", e))?;
        licencia::asegurar_registro(&conn);
        let config = config::cargar(&data_dir);

        let st = AppState {
            db: Arc::new(Mutex::new(conn)),
            tokens: Arc::new(Mutex::new(HashMap::new())),
            local_user: Mutex::new(None),
            client_token: Mutex::new(None),
            config: Mutex::new(config.clone()),
            data_dir,
            error_servidor: Mutex::new(None),
        };

        if config.modo == "servidor" {
            if let Err(e) = servidor::iniciar(st.db.clone(), st.tokens.clone(), config.puerto) {
                *bloquear(&st.error_servidor) = Some(e);
            }
        }
        Ok(st)
    }
}

fn info_red(st: &AppState) -> Value {
    let cfg = bloquear(&st.config).clone();
    json!({
        "modo": cfg.modo,
        "puerto": cfg.puerto,
        "servidor_url": cfg.servidor_url,
        "ips": config::ips_locales(),
        "error_servidor": bloquear(&st.error_servidor).clone(),
        "sesiones_activas": bloquear(&st.tokens).len(),
        "version": dispatch::VERSION,
    })
}

fn guardar_config(st: &AppState, args: &Value) -> Result<Value, String> {
    // Antes del login cualquiera puede configurarla (un equipo nuevo lo necesita);
    // con sesión iniciada, solo un administrador.
    if let Some(u) = bloquear(&st.local_user).as_ref() {
        if u.rol != "admin" {
            return Err("Solo un administrador puede cambiar la configuración de red".into());
        }
    }
    let modo = args.get("modo").and_then(|v| v.as_str()).unwrap_or("independiente").to_string();
    let puerto = args.get("puerto").and_then(|v| v.as_u64()).unwrap_or(config::PUERTO_DEFECTO as u64);
    let servidor_url = args.get("servidorUrl").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let nueva = config::validar(&Config {
        modo,
        puerto: u16::try_from(puerto).map_err(|_| "El puerto no es válido".to_string())?,
        servidor_url,
    })?;
    config::guardar(&st.data_dir, &nueva)?;
    {
        let conn = bloquear(&st.db);
        let u = bloquear(&st.local_user).clone();
        audit::registrar(
            &conn,
            u.as_ref(),
            "config_red",
            "red",
            None,
            &format!("Modo de red: {}{}", nueva.modo, if nueva.modo == "cliente" { format!(" → {}", nueva.servidor_url) } else { String::new() }),
        );
    }
    Ok(json!({ "reiniciar": true, "config": nueva }))
}

fn reenviar(st: &AppState, cfg: &Config, cmd: &str, args: Value) -> Result<Value, String> {
    let token = bloquear(&st.client_token).clone();
    let r = cliente::llamar(&cfg.servidor_url, token.as_deref(), cmd, &args);

    match (cmd, r) {
        ("login", Ok(v)) => {
            let usuario: UsuarioPublico = serde_json::from_value(v.clone()).map_err(|e| e.to_string())?;
            if let Some(t) = v.get("token").and_then(|t| t.as_str()) {
                *bloquear(&st.client_token) = Some(t.to_string());
            }
            *bloquear(&st.local_user) = Some(usuario.clone());
            Ok(serde_json::to_value(usuario).map_err(|e| e.to_string())?)
        }
        ("logout", _) => {
            *bloquear(&st.client_token) = None;
            *bloquear(&st.local_user) = None;
            Ok(Value::Null)
        }
        (_, Err(e)) => {
            if e == "SESION_EXPIRADA" {
                *bloquear(&st.client_token) = None;
                *bloquear(&st.local_user) = None;
            }
            Err(e)
        }
        (_, ok) => ok,
    }
}

pub fn ejecutar(st: &AppState, cmd: &str, args: Value) -> Result<Value, String> {
    // Comandos que siempre se resuelven en este equipo
    match cmd {
        "obtener_config" => return Ok(info_red(st)),
        "guardar_config" => return guardar_config(st, &args),
        "probar_conexion" => {
            let url = args.get("url").and_then(|v| v.as_str()).unwrap_or("");
            let base = config::normalizar_url(url)?;
            return cliente::llamar(&base, None, "ping", &Value::Null);
        }
        _ => {}
    }

    let cfg = bloquear(&st.config).clone();
    if cfg.modo == "cliente" {
        return reenviar(st, &cfg, cmd, args);
    }

    // Independiente o servidor: se ejecuta contra la base local
    match cmd {
        "login" => {
            let mut conn = bloquear(&st.db);
            let v = dispatch::despachar(&mut conn, &Ctx::default(), "login", &args)?;
            let usuario: UsuarioPublico = serde_json::from_value(v.clone()).map_err(|e| e.to_string())?;
            *bloquear(&st.local_user) = Some(usuario);
            Ok(v)
        }
        "logout" => {
            let u = bloquear(&st.local_user).take();
            if let Some(u) = u {
                let conn = bloquear(&st.db);
                audit::registrar(&conn, Some(&u), "logout", "usuario", Some(u.id), "Cerró sesión");
            }
            Ok(Value::Null)
        }
        _ => {
            let usuario = bloquear(&st.local_user).clone();
            let mut conn = bloquear(&st.db);
            let r = dispatch::despachar(&mut conn, &Ctx { usuario }, cmd, &args);
            if matches!(&r, Err(e) if e == "SESION_EXPIRADA") {
                *bloquear(&st.local_user) = None;
            }
            r
        }
    }
}
