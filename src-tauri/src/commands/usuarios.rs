use super::Ctx;
use crate::audit;
use chrono::{Duration, Local};
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct UsuarioPublico {
    pub id: i64,
    pub nombre: String,
    pub usuario: String,
    pub rol: String,
    pub activo: bool,
}

const MAX_FALLOS: i64 = 8; // por usuario, en 5 minutos

pub fn login(conn: &Connection, usuario: &str, password: &str) -> Result<UsuarioPublico, String> {
    let usuario = usuario.trim();
    let marca = format!("Usuario: {}", usuario);

    // Freno básico contra adivinar contraseñas por la red
    let desde = (Local::now() - Duration::minutes(5)).to_rfc3339();
    let fallos: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM auditoria WHERE accion = 'login_fallido' AND detalle = ?1 AND fecha > ?2",
            params![marca, desde],
            |r| r.get(0),
        )
        .unwrap_or(0);
    if fallos >= MAX_FALLOS {
        return Err("Demasiados intentos fallidos. Espera unos minutos e intenta de nuevo.".into());
    }

    let fila = conn.query_row(
        "SELECT id, nombre, usuario, password_hash, rol, activo FROM usuarios WHERE usuario = ?1",
        params![usuario],
        |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
                row.get::<_, String>(4)?,
                row.get::<_, i64>(5)?,
            ))
        },
    );

    if let Ok((id, nombre, usuario_db, hash, rol, activo)) = fila {
        let valido = bcrypt::verify(password, &hash).unwrap_or(false);
        if valido {
            if activo == 0 {
                return Err("Este usuario está desactivado".into());
            }
            let u = UsuarioPublico { id, nombre, usuario: usuario_db, rol, activo: true };
            audit::registrar(conn, Some(&u), "login", "usuario", Some(u.id), "Inicio de sesión");
            return Ok(u);
        }
    }

    audit::registrar(conn, None, "login_fallido", "usuario", None, &marca);
    Err("Usuario o contraseña incorrectos".into())
}

/// Vuelve a leer al usuario de la base: si fue desactivado o cambió de rol, la sesión lo refleja al instante.
pub fn vigente(conn: &Connection, u: &UsuarioPublico) -> Option<UsuarioPublico> {
    conn.query_row(
        "SELECT id, nombre, usuario, rol, activo FROM usuarios WHERE id = ?1",
        params![u.id],
        |row| {
            Ok(UsuarioPublico {
                id: row.get(0)?,
                nombre: row.get(1)?,
                usuario: row.get(2)?,
                rol: row.get(3)?,
                activo: row.get::<_, i64>(4)? != 0,
            })
        },
    )
    .ok()
    .filter(|u| u.activo)
}

pub fn listar_usuarios(conn: &Connection) -> Result<Vec<UsuarioPublico>, String> {
    let mut stmt = conn
        .prepare("SELECT id, nombre, usuario, rol, activo FROM usuarios ORDER BY nombre ASC")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            Ok(UsuarioPublico {
                id: row.get(0)?,
                nombre: row.get(1)?,
                usuario: row.get(2)?,
                rol: row.get(3)?,
                activo: row.get::<_, i64>(4)? != 0,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
    Ok(rows)
}

#[derive(Deserialize)]
pub struct NuevoUsuario {
    pub nombre: String,
    pub usuario: String,
    pub password: String,
    pub rol: String,
}

pub fn crear_usuario(conn: &Connection, ctx: &Ctx, nuevo: NuevoUsuario) -> Result<UsuarioPublico, String> {
    let nombre = nuevo.nombre.trim().to_string();
    let login_nombre = nuevo.usuario.trim().to_string();
    if nombre.is_empty() || login_nombre.is_empty() {
        return Err("Nombre y usuario son obligatorios".into());
    }
    if nuevo.password.len() < 4 {
        return Err("La contraseña debe tener al menos 4 caracteres".into());
    }
    if nuevo.rol != "admin" && nuevo.rol != "cajero" {
        return Err("Rol inválido".into());
    }
    let existe: i64 = conn
        .query_row("SELECT COUNT(*) FROM usuarios WHERE usuario = ?1", params![login_nombre], |r| r.get(0))
        .map_err(|e| e.to_string())?;
    if existe > 0 {
        return Err("Ya existe un usuario con ese nombre de usuario".into());
    }
    let hash = bcrypt::hash(&nuevo.password, bcrypt::DEFAULT_COST).map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO usuarios (nombre, usuario, password_hash, rol, activo) VALUES (?1,?2,?3,?4,1)",
        params![nombre, login_nombre, hash, nuevo.rol],
    )
    .map_err(|e| e.to_string())?;
    let id = conn.last_insert_rowid();
    audit::registrar(
        conn,
        ctx.usuario.as_ref(),
        "crear_usuario",
        "usuario",
        Some(id),
        &format!("Creó al usuario {} ({}) con rol {}", nombre, login_nombre, nuevo.rol),
    );
    Ok(UsuarioPublico { id, nombre, usuario: login_nombre, rol: nuevo.rol, activo: true })
}

pub fn cambiar_estado_usuario(conn: &Connection, ctx: &Ctx, id: i64, activo: bool) -> Result<(), String> {
    let yo = ctx.usuario()?;
    if id == yo.id && !activo {
        return Err("No puedes desactivar tu propio usuario".into());
    }
    let (nombre, usuario): (String, String) = conn
        .query_row("SELECT nombre, usuario FROM usuarios WHERE id = ?1", params![id], |r| {
            Ok((r.get(0)?, r.get(1)?))
        })
        .map_err(|_| "Usuario no encontrado".to_string())?;
    conn.execute("UPDATE usuarios SET activo = ?1 WHERE id = ?2", params![activo as i64, id])
        .map_err(|e| e.to_string())?;
    audit::registrar(
        conn,
        Some(yo),
        "cambiar_estado_usuario",
        "usuario",
        Some(id),
        &format!("{} al usuario {} ({})", if activo { "Activó" } else { "Desactivó" }, nombre, usuario),
    );
    Ok(())
}
