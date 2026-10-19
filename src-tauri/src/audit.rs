// Registro de auditoría: quién hizo qué y cuándo.
// Se escribe dentro de la misma transacción de la operación cuando existe una,
// de modo que no puede haber una venta sin su registro (ni al revés).

use crate::commands::usuarios::UsuarioPublico;
use chrono::Local;
use rusqlite::{params, params_from_iter, types::Value, Connection};
use serde::{Deserialize, Serialize};

#[derive(Serialize)]
pub struct Evento {
    pub id: i64,
    pub fecha: String,
    pub usuario_id: Option<i64>,
    pub usuario_nombre: Option<String>,
    pub accion: String,
    pub entidad: Option<String>,
    pub entidad_id: Option<i64>,
    pub detalle: Option<String>,
}

#[derive(Deserialize, Default)]
pub struct FiltroAuditoria {
    pub usuario_id: Option<i64>,
    pub accion: Option<String>,
    pub desde: Option<String>, // YYYY-MM-DD
    pub hasta: Option<String>, // YYYY-MM-DD
    pub texto: Option<String>,
    pub limite: Option<i64>,
}

pub fn registrar(
    conn: &Connection,
    usuario: Option<&UsuarioPublico>,
    accion: &str,
    entidad: &str,
    entidad_id: Option<i64>,
    detalle: &str,
) {
    let fecha = Local::now().to_rfc3339();
    let _ = conn.execute(
        "INSERT INTO auditoria (fecha, usuario_id, usuario_nombre, accion, entidad, entidad_id, detalle)
         VALUES (?1,?2,?3,?4,?5,?6,?7)",
        params![
            fecha,
            usuario.map(|u| u.id),
            usuario.map(|u| format!("{} ({})", u.nombre, u.usuario)),
            accion,
            entidad,
            entidad_id,
            detalle
        ],
    );
}

pub fn listar(conn: &Connection, f: FiltroAuditoria) -> Result<Vec<Evento>, String> {
    let mut sql = String::from(
        "SELECT id, fecha, usuario_id, usuario_nombre, accion, entidad, entidad_id, detalle
         FROM auditoria WHERE 1=1",
    );
    let mut vals: Vec<Value> = Vec::new();

    if let Some(u) = f.usuario_id {
        sql.push_str(" AND usuario_id = ?");
        vals.push(Value::Integer(u));
    }
    if let Some(a) = f.accion.filter(|a| !a.is_empty()) {
        sql.push_str(" AND accion = ?");
        vals.push(Value::Text(a));
    }
    if let Some(d) = f.desde.filter(|d| !d.is_empty()) {
        sql.push_str(" AND substr(fecha,1,10) >= ?");
        vals.push(Value::Text(d));
    }
    if let Some(h) = f.hasta.filter(|h| !h.is_empty()) {
        sql.push_str(" AND substr(fecha,1,10) <= ?");
        vals.push(Value::Text(h));
    }
    if let Some(t) = f.texto.filter(|t| !t.trim().is_empty()) {
        let patron = format!("%{}%", t.trim().to_lowercase());
        sql.push_str(
            " AND (lower(COALESCE(detalle,'')) LIKE ? OR lower(COALESCE(usuario_nombre,'')) LIKE ? OR lower(COALESCE(entidad,'')) LIKE ?)",
        );
        vals.push(Value::Text(patron.clone()));
        vals.push(Value::Text(patron.clone()));
        vals.push(Value::Text(patron));
    }
    let limite = f.limite.unwrap_or(500).clamp(1, 5000);
    sql.push_str(" ORDER BY id DESC LIMIT ?");
    vals.push(Value::Integer(limite));

    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let filas = stmt
        .query_map(params_from_iter(vals), |row| {
            Ok(Evento {
                id: row.get(0)?,
                fecha: row.get(1)?,
                usuario_id: row.get(2)?,
                usuario_nombre: row.get(3)?,
                accion: row.get(4)?,
                entidad: row.get(5)?,
                entidad_id: row.get(6)?,
                detalle: row.get(7)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
    Ok(filas)
}
