use super::Ctx;
use crate::audit;
use chrono::Local;
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};

#[derive(Serialize)]
pub struct MovimientoCaja {
    pub id: i64,
    pub fecha: String, // YYYY-MM-DD, la fecha a la que corresponde el movimiento
    pub tipo: String,  // "ingreso" | "egreso"
    pub concepto: String,
    pub monto: f64,
    pub usuario_id: i64,
    pub usuario_nombre: String,
    pub caja_sesion_id: Option<i64>,
    pub registrado: String,
}

#[derive(Deserialize)]
pub struct NuevoMovimiento {
    pub tipo: String,
    pub fecha: String,
    pub concepto: String,
    pub monto: f64,
}

fn hoy() -> String {
    Local::now().format("%Y-%m-%d").to_string()
}

fn fecha_valida(f: &str) -> bool {
    chrono::NaiveDate::parse_from_str(f, "%Y-%m-%d").is_ok()
}

/// Ingreso: suma a la caja. Egreso: resta de la caja.
/// Si corresponde a hoy y quien lo registra tiene su caja abierta, entra en el cierre de esa caja.
pub fn registrar_movimiento(conn: &Connection, ctx: &Ctx, n: NuevoMovimiento) -> Result<MovimientoCaja, String> {
    let user = ctx.usuario()?;
    if n.tipo != "ingreso" && n.tipo != "egreso" {
        return Err("El tipo debe ser ingreso o egreso".into());
    }
    let concepto = n.concepto.trim().to_string();
    if concepto.is_empty() {
        return Err("Escribe el concepto".into());
    }
    if !(n.monto > 0.0) || !n.monto.is_finite() {
        return Err("El monto debe ser mayor a cero".into());
    }
    let n_monto = (n.monto * 100.0).round() / 100.0;
    if !fecha_valida(&n.fecha) {
        return Err("La fecha no es válida".into());
    }
    let hoy = hoy();
    if user.rol != "admin" && n.fecha != hoy {
        return Err("Solo un administrador puede registrar movimientos de otra fecha".into());
    }
    if n.fecha > hoy {
        return Err("La fecha no puede ser futura".into());
    }
    let caja: Option<i64> = if n.fecha == hoy {
        conn.query_row(
            "SELECT id FROM caja_sesiones WHERE usuario_id = ?1 AND fecha_cierre IS NULL ORDER BY id DESC LIMIT 1",
            params![user.id],
            |r| r.get(0),
        )
        .ok()
    } else {
        None
    };
    if user.rol != "admin" && caja.is_none() {
        return Err("Abre tu caja antes de registrar movimientos".into());
    }
    let registrado = Local::now().to_rfc3339();
    conn.execute(
        "INSERT INTO movimientos_caja (fecha, tipo, concepto, monto, usuario_id, caja_sesion_id, registrado)
         VALUES (?1,?2,?3,?4,?5,?6,?7)",
        params![n.fecha, n.tipo, concepto, n_monto, user.id, caja, registrado],
    )
    .map_err(|e| e.to_string())?;
    let id = conn.last_insert_rowid();
    audit::registrar(
        conn,
        Some(user),
        if n.tipo == "ingreso" { "ingreso_caja" } else { "egreso_caja" },
        "caja",
        Some(id),
        &format!(
            "{} de Bs {:.2} · {} · fecha {}",
            if n.tipo == "ingreso" { "Ingreso" } else { "Egreso" },
            n_monto,
            concepto,
            n.fecha
        ),
    );
    Ok(MovimientoCaja {
        id,
        fecha: n.fecha,
        tipo: n.tipo,
        concepto,
        monto: n_monto,
        usuario_id: user.id,
        usuario_nombre: user.nombre.clone(),
        caja_sesion_id: caja,
        registrado,
    })
}

#[derive(Deserialize, Default)]
pub struct FiltroMovimientos {
    pub desde: Option<String>,
    pub hasta: Option<String>,
    pub tipo: Option<String>,
}

/// El cajero solo ve los suyos; el administrador ve todos.
pub fn listar_movimientos(conn: &Connection, ctx: &Ctx, f: FiltroMovimientos) -> Result<Vec<MovimientoCaja>, String> {
    let user = ctx.usuario()?;
    let solo_mio: Option<i64> = if user.rol == "admin" { None } else { Some(user.id) };
    let mut stmt = conn
        .prepare(
            "SELECT m.id, m.fecha, m.tipo, m.concepto, m.monto, m.usuario_id, u.nombre, m.caja_sesion_id, m.registrado
             FROM movimientos_caja m JOIN usuarios u ON u.id = m.usuario_id
             WHERE (?1 IS NULL OR m.usuario_id = ?1)
               AND (?2 IS NULL OR m.fecha >= ?2)
               AND (?3 IS NULL OR m.fecha <= ?3)
               AND (?4 IS NULL OR m.tipo = ?4)
             ORDER BY m.fecha DESC, m.id DESC LIMIT 2000",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(
            params![
                solo_mio,
                f.desde.filter(|d| !d.is_empty()),
                f.hasta.filter(|d| !d.is_empty()),
                f.tipo.filter(|d| !d.is_empty())
            ],
            |r| {
                Ok(MovimientoCaja {
                    id: r.get(0)?,
                    fecha: r.get(1)?,
                    tipo: r.get(2)?,
                    concepto: r.get(3)?,
                    monto: r.get(4)?,
                    usuario_id: r.get(5)?,
                    usuario_nombre: r.get(6)?,
                    caja_sesion_id: r.get(7)?,
                    registrado: r.get(8)?,
                })
            },
        )
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
    Ok(rows)
}

/// Solo administrador. Si el movimiento ya entró en una caja cerrada, no se puede borrar.
pub fn eliminar_movimiento(conn: &Connection, ctx: &Ctx, id: i64) -> Result<(), String> {
    let user = ctx.usuario()?;
    let (fecha, tipo, concepto, monto, caja): (String, String, String, f64, Option<i64>) = conn
        .query_row(
            "SELECT fecha, tipo, concepto, monto, caja_sesion_id FROM movimientos_caja WHERE id = ?1",
            params![id],
            |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?, r.get(4)?)),
        )
        .map_err(|_| "Movimiento no encontrado".to_string())?;
    if let Some(c) = caja {
        let cerrada: bool = conn
            .query_row("SELECT fecha_cierre IS NOT NULL FROM caja_sesiones WHERE id = ?1", params![c], |r| r.get(0))
            .unwrap_or(false);
        if cerrada {
            return Err("Este movimiento ya forma parte de una caja cerrada y no se puede eliminar".into());
        }
    }
    conn.execute("DELETE FROM movimientos_caja WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    audit::registrar(
        conn,
        Some(user),
        "eliminar_movimiento_caja",
        "caja",
        Some(id),
        &format!("Eliminó {} de Bs {:.2} · {} · fecha {}", tipo, monto, concepto, fecha),
    );
    Ok(())
}

/// (ingresos, egresos) que entraron en una caja concreta
pub fn totales_de_caja(conn: &Connection, caja_sesion_id: i64) -> (f64, f64) {
    conn.query_row(
        "SELECT COALESCE(SUM(CASE WHEN tipo='ingreso' THEN monto END),0), COALESCE(SUM(CASE WHEN tipo='egreso' THEN monto END),0)
         FROM movimientos_caja WHERE caja_sesion_id = ?1",
        params![caja_sesion_id],
        |r| Ok((r.get(0)?, r.get(1)?)),
    )
    .unwrap_or((0.0, 0.0))
}
