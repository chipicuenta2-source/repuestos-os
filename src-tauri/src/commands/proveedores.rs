use super::Ctx;
use crate::audit;
use chrono::Local;
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone)]
pub struct Proveedor {
    pub id: i64,
    pub nombre: String,
    pub categoria: Option<String>,
    pub telefono: Option<String>,
    pub saldo: f64,
}

#[derive(Deserialize)]
pub struct NuevoProveedor {
    pub nombre: String,
    pub categoria: Option<String>,
    pub telefono: Option<String>,
}

fn saldo_de(conn: &Connection, proveedor_id: i64) -> f64 {
    conn.query_row(
        "SELECT COALESCE(SUM(CASE WHEN tipo = 'compra_credito' THEN monto ELSE -monto END),0)
         FROM movimientos_proveedor WHERE proveedor_id = ?1",
        params![proveedor_id],
        |r| r.get(0),
    )
    .unwrap_or(0.0)
}

pub fn listar_proveedores(conn: &Connection) -> Result<Vec<Proveedor>, String> {
    let mut stmt = conn
        .prepare("SELECT id, nombre, categoria, telefono FROM proveedores ORDER BY nombre ASC")
        .map_err(|e| e.to_string())?;
    let base: Vec<(i64, String, Option<String>, Option<String>)> = stmt
        .query_map([], |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)))
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
    Ok(base
        .into_iter()
        .map(|(id, nombre, categoria, telefono)| Proveedor {
            id,
            nombre,
            categoria,
            telefono,
            saldo: saldo_de(conn, id),
        })
        .collect())
}

pub fn crear_proveedor(conn: &Connection, ctx: &Ctx, p: NuevoProveedor) -> Result<Proveedor, String> {
    let nombre = p.nombre.trim().to_string();
    if nombre.is_empty() {
        return Err("El nombre del proveedor es obligatorio".into());
    }
    conn.execute(
        "INSERT INTO proveedores (nombre, categoria, telefono) VALUES (?1,?2,?3)",
        params![nombre, p.categoria, p.telefono],
    )
    .map_err(|e| e.to_string())?;
    let id = conn.last_insert_rowid();
    audit::registrar(conn, ctx.usuario.as_ref(), "crear_proveedor", "proveedor", Some(id), &format!("Creó al proveedor {}", nombre));
    Ok(Proveedor { id, nombre, categoria: p.categoria, telefono: p.telefono, saldo: 0.0 })
}

#[derive(Deserialize)]
pub struct ItemCompraInput {
    pub producto_id: i64,
    pub cantidad: i64,
    pub costo_unitario: f64,
}

#[derive(Deserialize)]
pub struct NuevaCompra {
    pub proveedor_id: i64,
    pub es_credito: bool,
    pub items: Vec<ItemCompraInput>,
}

pub fn registrar_compra(conn: &mut Connection, ctx: &Ctx, compra: NuevaCompra) -> Result<i64, String> {
    if compra.items.is_empty() {
        return Err("La compra no tiene productos".into());
    }
    for i in &compra.items {
        if i.cantidad <= 0 {
            return Err("Las cantidades deben ser mayores a cero".into());
        }
        if i.costo_unitario < 0.0 {
            return Err("El costo unitario no puede ser negativo".into());
        }
    }
    let tx = conn.transaction().map_err(|e| e.to_string())?;
    let proveedor_nombre: String = tx
        .query_row("SELECT nombre FROM proveedores WHERE id = ?1", params![compra.proveedor_id], |r| r.get(0))
        .map_err(|_| "Proveedor no encontrado".to_string())?;
    let fecha = Local::now().to_rfc3339();
    let monto_total: f64 = compra.items.iter().map(|i| i.costo_unitario * i.cantidad as f64).sum();

    tx.execute(
        "INSERT INTO compras (proveedor_id, fecha, es_credito, monto_total, monto_abonado, usuario_id) VALUES (?1,?2,?3,?4,?5,?6)",
        params![
            compra.proveedor_id,
            fecha,
            compra.es_credito as i64,
            monto_total,
            if compra.es_credito { 0.0 } else { monto_total },
            ctx.usuario.as_ref().map(|u| u.id)
        ],
    )
    .map_err(|e| e.to_string())?;
    let compra_id = tx.last_insert_rowid();

    for item in &compra.items {
        let existe: i64 = tx
            .query_row("SELECT COUNT(*) FROM productos WHERE id = ?1 AND activo = 1", params![item.producto_id], |r| r.get(0))
            .map_err(|e| e.to_string())?;
        if existe == 0 {
            return Err("Hay un producto de la compra que ya no existe".into());
        }
        tx.execute(
            "INSERT INTO compra_items (compra_id, producto_id, cantidad, costo_unitario) VALUES (?1,?2,?3,?4)",
            params![compra_id, item.producto_id, item.cantidad, item.costo_unitario],
        )
        .map_err(|e| e.to_string())?;
        tx.execute(
            "UPDATE productos SET stock = stock + ?1 WHERE id = ?2",
            params![item.cantidad, item.producto_id],
        )
        .map_err(|e| e.to_string())?;
    }

    if compra.es_credito {
        tx.execute(
            "INSERT INTO movimientos_proveedor (proveedor_id, tipo, monto, fecha, descripcion) VALUES (?1,'compra_credito',?2,?3,?4)",
            params![compra.proveedor_id, monto_total, fecha, format!("Compra #{}", compra_id)],
        )
        .map_err(|e| e.to_string())?;
    }

    audit::registrar(
        &tx,
        ctx.usuario.as_ref(),
        "compra",
        "compra",
        Some(compra_id),
        &format!(
            "Compra #{} a {} · {} producto(s) · Bs {:.2} · {}",
            compra_id,
            proveedor_nombre,
            compra.items.len(),
            monto_total,
            if compra.es_credito { "a crédito" } else { "al contado" }
        ),
    );
    tx.commit().map_err(|e| e.to_string())?;
    Ok(compra_id)
}

pub fn registrar_pago_proveedor(conn: &Connection, ctx: &Ctx, proveedor_id: i64, monto: f64) -> Result<(), String> {
    if monto <= 0.0 {
        return Err("El monto debe ser mayor a cero".into());
    }
    let nombre: String = conn
        .query_row("SELECT nombre FROM proveedores WHERE id = ?1", params![proveedor_id], |r| r.get(0))
        .map_err(|_| "Proveedor no encontrado".to_string())?;
    let saldo = saldo_de(conn, proveedor_id);
    if monto > saldo + 0.005 {
        return Err(format!("El pago (Bs {:.2}) supera el saldo pendiente (Bs {:.2})", monto, saldo));
    }
    let fecha = Local::now().to_rfc3339();
    conn.execute(
        "INSERT INTO movimientos_proveedor (proveedor_id, tipo, monto, fecha, descripcion) VALUES (?1,'pago',?2,?3,'Pago a proveedor')",
        params![proveedor_id, monto, fecha],
    )
    .map_err(|e| e.to_string())?;
    audit::registrar(
        conn,
        ctx.usuario.as_ref(),
        "pago_proveedor",
        "proveedor",
        Some(proveedor_id),
        &format!("Pagó Bs {:.2} a {} (saldo restante Bs {:.2})", monto, nombre, saldo - monto),
    );
    Ok(())
}

#[derive(Serialize)]
pub struct MovimientoProveedor {
    pub id: i64,
    pub tipo: String,
    pub monto: f64,
    pub fecha: String,
    pub descripcion: Option<String>,
}

pub fn listar_movimientos_proveedor(conn: &Connection, proveedor_id: i64) -> Result<Vec<MovimientoProveedor>, String> {
    let mut stmt = conn
        .prepare("SELECT id, tipo, monto, fecha, descripcion FROM movimientos_proveedor WHERE proveedor_id = ?1 ORDER BY fecha DESC")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![proveedor_id], |row| {
            Ok(MovimientoProveedor {
                id: row.get(0)?,
                tipo: row.get(1)?,
                monto: row.get(2)?,
                fecha: row.get(3)?,
                descripcion: row.get(4)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
    Ok(rows)
}

#[derive(Deserialize, Default)]
pub struct FiltroCompras {
    pub proveedor_id: Option<i64>,
    pub desde: Option<String>,
    pub hasta: Option<String>,
}

#[derive(Serialize)]
pub struct CompraResumen {
    pub id: i64,
    pub proveedor_id: i64,
    pub proveedor_nombre: String,
    pub fecha: String,
    pub es_credito: bool,
    pub monto_total: f64,
    pub usuario_nombre: Option<String>,
    pub unidades: i64,
    pub productos: i64,
}

pub fn listar_compras(conn: &Connection, f: FiltroCompras) -> Result<Vec<CompraResumen>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT c.id, c.proveedor_id, p.nombre, c.fecha, c.es_credito, c.monto_total, u.nombre,
                    COALESCE((SELECT SUM(cantidad) FROM compra_items WHERE compra_id = c.id),0),
                    COALESCE((SELECT COUNT(*) FROM compra_items WHERE compra_id = c.id),0)
             FROM compras c
             JOIN proveedores p ON p.id = c.proveedor_id
             LEFT JOIN usuarios u ON u.id = c.usuario_id
             WHERE (?1 IS NULL OR c.proveedor_id = ?1)
               AND (?2 IS NULL OR substr(c.fecha,1,10) >= ?2)
               AND (?3 IS NULL OR substr(c.fecha,1,10) <= ?3)
             ORDER BY c.id DESC LIMIT 2000",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(
            params![f.proveedor_id, f.desde.filter(|d| !d.is_empty()), f.hasta.filter(|d| !d.is_empty())],
            |r| {
                Ok(CompraResumen {
                    id: r.get(0)?,
                    proveedor_id: r.get(1)?,
                    proveedor_nombre: r.get(2)?,
                    fecha: r.get(3)?,
                    es_credito: r.get::<_, i64>(4)? != 0,
                    monto_total: r.get(5)?,
                    usuario_nombre: r.get(6)?,
                    unidades: r.get(7)?,
                    productos: r.get(8)?,
                })
            },
        )
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
    Ok(rows)
}

#[derive(Serialize)]
pub struct ItemCompraDetalle {
    pub compra_id: i64,
    pub fecha: String,
    pub proveedor_nombre: String,
    pub producto_id: i64,
    pub nombre: String,
    pub codigo: Option<String>,
    pub oem: Option<String>,
    pub cantidad: i64,
    pub costo_unitario: f64,
}

/// Material que ingresó al almacén: una fila por producto de cada compra.
pub fn listar_items_compras(conn: &Connection, f: FiltroCompras) -> Result<Vec<ItemCompraDetalle>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT c.id, c.fecha, pr.nombre, i.producto_id, p.nombre, p.codigo, p.oem, i.cantidad, i.costo_unitario
             FROM compra_items i
             JOIN compras c ON c.id = i.compra_id
             JOIN proveedores pr ON pr.id = c.proveedor_id
             JOIN productos p ON p.id = i.producto_id
             WHERE (?1 IS NULL OR c.proveedor_id = ?1)
               AND (?2 IS NULL OR substr(c.fecha,1,10) >= ?2)
               AND (?3 IS NULL OR substr(c.fecha,1,10) <= ?3)
             ORDER BY c.id DESC, i.id ASC LIMIT 5000",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(
            params![f.proveedor_id, f.desde.filter(|d| !d.is_empty()), f.hasta.filter(|d| !d.is_empty())],
            |r| {
                Ok(ItemCompraDetalle {
                    compra_id: r.get(0)?,
                    fecha: r.get(1)?,
                    proveedor_nombre: r.get(2)?,
                    producto_id: r.get(3)?,
                    nombre: r.get(4)?,
                    codigo: r.get(5)?,
                    oem: r.get(6)?,
                    cantidad: r.get(7)?,
                    costo_unitario: r.get(8)?,
                })
            },
        )
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
    Ok(rows)
}

#[derive(Serialize)]
pub struct PagoProveedor {
    pub id: i64,
    pub proveedor_id: i64,
    pub proveedor_nombre: String,
    pub fecha: String,
    pub monto: f64,
}

pub fn listar_pagos_proveedores(conn: &Connection, f: FiltroCompras) -> Result<Vec<PagoProveedor>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT m.id, m.proveedor_id, p.nombre, m.fecha, m.monto
             FROM movimientos_proveedor m JOIN proveedores p ON p.id = m.proveedor_id
             WHERE m.tipo = 'pago'
               AND (?1 IS NULL OR m.proveedor_id = ?1)
               AND (?2 IS NULL OR substr(m.fecha,1,10) >= ?2)
               AND (?3 IS NULL OR substr(m.fecha,1,10) <= ?3)
             ORDER BY m.id DESC LIMIT 2000",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(
            params![f.proveedor_id, f.desde.filter(|d| !d.is_empty()), f.hasta.filter(|d| !d.is_empty())],
            |r| Ok(PagoProveedor { id: r.get(0)?, proveedor_id: r.get(1)?, proveedor_nombre: r.get(2)?, fecha: r.get(3)?, monto: r.get(4)? }),
        )
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
    Ok(rows)
}
