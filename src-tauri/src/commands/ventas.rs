use super::Ctx;
use crate::audit;
use chrono::Local;
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};

// ---------------------------------------------------------------------------
// Ventas
// ---------------------------------------------------------------------------

#[derive(Deserialize)]
pub struct ItemVentaInput {
    pub producto_id: i64,
    pub cantidad: i64,
    // El precio lo decide el servidor a partir del producto; este campo se ignora a propósito.
    #[allow(dead_code)]
    pub precio_unitario: Option<f64>,
}

#[derive(Deserialize)]
pub struct NuevaVenta {
    pub caja_sesion_id: i64,
    pub cliente_id: Option<i64>,
    pub es_credito: bool,
    pub es_facturado: bool,
    pub metodo_pago: String,
    pub monto_pagado_inicial: f64,
    pub nombre_comprador: Option<String>,
    pub items: Vec<ItemVentaInput>,
}

#[derive(Serialize, Clone)]
pub struct Venta {
    pub id: i64,
    pub fecha: String,
    pub caja_sesion_id: i64,
    pub usuario_id: i64,
    pub usuario_nombre: Option<String>,
    pub cliente_id: Option<i64>,
    pub cliente_nombre: Option<String>,
    pub es_credito: bool,
    pub es_facturado: bool,
    pub metodo_pago: String,
    pub monto_total: f64,
    pub monto_abonado: f64,
    pub nombre_comprador: Option<String>,
    pub cantidad_items: i64,
}

const SELECT_VENTA: &str = "
    SELECT v.id, v.fecha, v.caja_sesion_id, v.usuario_id, u.nombre, v.cliente_id, c.nombre,
           v.es_credito, v.es_facturado, v.metodo_pago, v.monto_total, v.monto_abonado, v.nombre_comprador,
           (SELECT COALESCE(SUM(cantidad),0) FROM venta_items vi WHERE vi.venta_id = v.id)
    FROM ventas v
    LEFT JOIN usuarios u ON u.id = v.usuario_id
    LEFT JOIN clientes c ON c.id = v.cliente_id
";

fn map_venta(row: &rusqlite::Row) -> rusqlite::Result<Venta> {
    Ok(Venta {
        id: row.get(0)?,
        fecha: row.get(1)?,
        caja_sesion_id: row.get(2)?,
        usuario_id: row.get(3)?,
        usuario_nombre: row.get(4)?,
        cliente_id: row.get(5)?,
        cliente_nombre: row.get(6)?,
        es_credito: row.get::<_, i64>(7)? != 0,
        es_facturado: row.get::<_, i64>(8)? != 0,
        metodo_pago: row.get(9)?,
        monto_total: row.get(10)?,
        monto_abonado: row.get(11)?,
        nombre_comprador: row.get(12)?,
        cantidad_items: row.get(13)?,
    })
}

pub fn registrar_venta(conn: &mut Connection, ctx: &Ctx, venta: NuevaVenta) -> Result<Venta, String> {
    let user = ctx.usuario()?.clone();
    if venta.items.is_empty() {
        return Err("El ticket está vacío".into());
    }
    if venta.metodo_pago != "efectivo" && venta.metodo_pago != "qr" {
        return Err("Método de pago inválido".into());
    }
    for i in &venta.items {
        if i.cantidad <= 0 {
            return Err("Las cantidades deben ser mayores a cero".into());
        }
    }

    let tx = conn.transaction().map_err(|e| e.to_string())?;

    // La caja debe existir, estar abierta y ser del usuario que vende
    let (caja_user, cierre): (i64, Option<String>) = tx
        .query_row(
            "SELECT usuario_id, fecha_cierre FROM caja_sesiones WHERE id = ?1",
            params![venta.caja_sesion_id],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .map_err(|_| "La caja indicada no existe".to_string())?;
    if cierre.is_some() {
        return Err("Esta caja ya está cerrada. Abre una nueva caja para vender.".into());
    }
    if caja_user != user.id {
        return Err("Esta caja pertenece a otro usuario".into());
    }

    if venta.es_credito {
        match venta.cliente_id {
            None => return Err("Una venta a crédito necesita un cliente".into()),
            Some(cid) => {
                let existe: i64 = tx
                    .query_row("SELECT COUNT(*) FROM clientes WHERE id = ?1", params![cid], |r| r.get(0))
                    .map_err(|e| e.to_string())?;
                if existe == 0 {
                    return Err("El cliente seleccionado no existe".into());
                }
            }
        }
    }

    // Precios y stock se resuelven aquí, dentro de la transacción, con el estado real de la base
    let mut lineas: Vec<(i64, i64, f64)> = Vec::new(); // (producto_id, cantidad, precio)
    let mut monto_total = 0.0;
    for item in &venta.items {
        let (nombre, stock, p_venta, p_fact): (String, i64, f64, f64) = tx
            .query_row(
                "SELECT nombre, stock, precio_venta, precio_facturado FROM productos WHERE id = ?1 AND activo = 1",
                params![item.producto_id],
                |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?)),
            )
            .map_err(|_| "Hay un producto del ticket que ya no existe".to_string())?;
        let ya_en_ticket: i64 = lineas.iter().filter(|l| l.0 == item.producto_id).map(|l| l.1).sum();
        if stock - ya_en_ticket < item.cantidad {
            return Err(format!(
                "Stock insuficiente de {}: quedan {} y pediste {}",
                nombre,
                stock - ya_en_ticket,
                item.cantidad
            ));
        }
        let precio = if venta.es_facturado { p_fact } else { p_venta };
        monto_total += precio * item.cantidad as f64;
        lineas.push((item.producto_id, item.cantidad, precio));
    }

    let monto_abonado = if venta.es_credito {
        if venta.monto_pagado_inicial < 0.0 || venta.monto_pagado_inicial > monto_total + 0.005 {
            return Err("El abono inicial no puede ser negativo ni mayor al total".into());
        }
        venta.monto_pagado_inicial
    } else {
        monto_total
    };

    let fecha = Local::now().to_rfc3339();
    let comprador = if venta.es_credito {
        None
    } else {
        venta.nombre_comprador.clone().filter(|s| !s.trim().is_empty())
    };

    tx.execute(
        "INSERT INTO ventas (caja_sesion_id, usuario_id, cliente_id, fecha, es_credito, es_facturado, metodo_pago, monto_total, monto_abonado, nombre_comprador)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10)",
        params![
            venta.caja_sesion_id,
            user.id,
            if venta.es_credito { venta.cliente_id } else { None },
            fecha,
            venta.es_credito as i64,
            venta.es_facturado as i64,
            venta.metodo_pago,
            monto_total,
            monto_abonado,
            comprador
        ],
    )
    .map_err(|e| e.to_string())?;
    let venta_id = tx.last_insert_rowid();

    for (producto_id, cantidad, precio) in &lineas {
        tx.execute(
            "INSERT INTO venta_items (venta_id, producto_id, cantidad, precio_unitario) VALUES (?1,?2,?3,?4)",
            params![venta_id, producto_id, cantidad, precio],
        )
        .map_err(|e| e.to_string())?;
        tx.execute(
            "UPDATE productos SET stock = stock - ?1 WHERE id = ?2",
            params![cantidad, producto_id],
        )
        .map_err(|e| e.to_string())?;
    }

    if venta.es_credito && monto_abonado > 0.0 {
        tx.execute(
            "INSERT INTO pagos_venta (venta_id, fecha, monto) VALUES (?1,?2,?3)",
            params![venta_id, fecha, monto_abonado],
        )
        .map_err(|e| e.to_string())?;
    }

    let detalle = format!(
        "Venta #{} · Bs {:.2} · {} · {} · {} unidad(es){}",
        venta_id,
        monto_total,
        if venta.es_facturado { "con factura" } else { "sin factura" },
        venta.metodo_pago,
        lineas.iter().map(|l| l.1).sum::<i64>(),
        if venta.es_credito {
            format!(" · a crédito (abono Bs {:.2})", monto_abonado)
        } else {
            String::new()
        }
    );
    audit::registrar(&tx, Some(&user), "venta", "venta", Some(venta_id), &detalle);
    tx.commit().map_err(|e| e.to_string())?;

    let sql = format!("{} WHERE v.id = ?1", SELECT_VENTA);
    conn.query_row(&sql, params![venta_id], map_venta).map_err(|e| e.to_string())
}

#[derive(Deserialize, Default)]
pub struct FiltroVentas {
    pub caja_sesion_id: Option<i64>,
    pub usuario_id: Option<i64>,
    pub desde: Option<String>,
    pub hasta: Option<String>,
}

pub fn listar_ventas(conn: &Connection, ctx: &Ctx, f: FiltroVentas) -> Result<Vec<Venta>, String> {
    let user = ctx.usuario()?;
    // Un cajero solo ve sus propias ventas, sin importar lo que pida
    let usuario_id = if user.rol == "admin" { f.usuario_id } else { Some(user.id) };
    let sql = format!(
        "{} WHERE (?1 IS NULL OR v.caja_sesion_id = ?1)
            AND (?2 IS NULL OR v.usuario_id = ?2)
            AND (?3 IS NULL OR substr(v.fecha,1,10) >= ?3)
            AND (?4 IS NULL OR substr(v.fecha,1,10) <= ?4)
         ORDER BY v.id DESC LIMIT 2000",
        SELECT_VENTA
    );
    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(
            params![f.caja_sesion_id, usuario_id, f.desde.filter(|d| !d.is_empty()), f.hasta.filter(|d| !d.is_empty())],
            map_venta,
        )
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
    Ok(rows)
}

#[derive(Serialize)]
pub struct ItemVenta {
    pub id: i64,
    pub producto_id: i64,
    pub nombre: String,
    pub codigo: Option<String>,
    pub oem: Option<String>,
    pub estante: Option<String>,
    pub cantidad: i64,
    pub precio_unitario: f64,
}

pub fn listar_items_venta(conn: &Connection, ctx: &Ctx, venta_id: i64) -> Result<Vec<ItemVenta>, String> {
    let user = ctx.usuario()?;
    let dueno: i64 = conn
        .query_row("SELECT usuario_id FROM ventas WHERE id = ?1", params![venta_id], |r| r.get(0))
        .map_err(|_| "Venta no encontrada".to_string())?;
    if user.rol != "admin" && dueno != user.id {
        return Err("No tienes permiso para ver esta venta".into());
    }
    let mut stmt = conn
        .prepare(
            "SELECT vi.id, vi.producto_id, p.nombre, p.codigo, p.oem, p.estante, vi.cantidad, vi.precio_unitario
             FROM venta_items vi JOIN productos p ON p.id = vi.producto_id
             WHERE vi.venta_id = ?1 ORDER BY vi.id",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![venta_id], |row| {
            Ok(ItemVenta {
                id: row.get(0)?,
                producto_id: row.get(1)?,
                nombre: row.get(2)?,
                codigo: row.get(3)?,
                oem: row.get(4)?,
                estante: row.get(5)?,
                cantidad: row.get(6)?,
                precio_unitario: row.get(7)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
    Ok(rows)
}

// ---------------------------------------------------------------------------
// Deudas de clientes
// ---------------------------------------------------------------------------

#[derive(Serialize)]
pub struct DeudaCliente {
    pub venta_id: i64,
    pub cliente_id: Option<i64>,
    pub cliente_nombre: String,
    pub fecha: String,
    pub monto_total: f64,
    pub monto_abonado: f64,
    pub saldo: f64,
}

pub fn listar_deudas_clientes(conn: &Connection, busqueda: &str) -> Result<Vec<DeudaCliente>, String> {
    let patron = format!("%{}%", busqueda.trim().to_lowercase());
    let sql = "
        SELECT v.id, v.cliente_id, COALESCE(c.nombre, v.nombre_comprador, 'Sin nombre'), v.fecha, v.monto_total, v.monto_abonado
        FROM ventas v
        LEFT JOIN clientes c ON c.id = v.cliente_id
        WHERE v.es_credito = 1 AND v.monto_abonado < v.monto_total - 0.005
          AND lower(COALESCE(c.nombre, v.nombre_comprador, '')) LIKE ?1
        ORDER BY v.fecha ASC
    ";
    let mut stmt = conn.prepare(sql).map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![patron], |row| {
            let monto_total: f64 = row.get(4)?;
            let monto_abonado: f64 = row.get(5)?;
            Ok(DeudaCliente {
                venta_id: row.get(0)?,
                cliente_id: row.get(1)?,
                cliente_nombre: row.get(2)?,
                fecha: row.get(3)?,
                monto_total,
                monto_abonado,
                saldo: monto_total - monto_abonado,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
    Ok(rows)
}

pub fn registrar_pago_venta(conn: &mut Connection, ctx: &Ctx, venta_id: i64, monto: f64) -> Result<(), String> {
    if monto <= 0.0 {
        return Err("El monto debe ser mayor a cero".into());
    }
    let tx = conn.transaction().map_err(|e| e.to_string())?;
    let (total, abonado, es_credito): (f64, f64, i64) = tx
        .query_row(
            "SELECT monto_total, monto_abonado, es_credito FROM ventas WHERE id = ?1",
            params![venta_id],
            |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
        )
        .map_err(|_| "Venta no encontrada".to_string())?;
    if es_credito == 0 {
        return Err("Esta venta no fue a crédito".into());
    }
    let saldo = total - abonado;
    if monto > saldo + 0.005 {
        return Err(format!("El abono (Bs {:.2}) supera el saldo pendiente (Bs {:.2})", monto, saldo));
    }
    let fecha = Local::now().to_rfc3339();
    tx.execute(
        "INSERT INTO pagos_venta (venta_id, fecha, monto) VALUES (?1,?2,?3)",
        params![venta_id, fecha, monto],
    )
    .map_err(|e| e.to_string())?;
    tx.execute(
        "UPDATE ventas SET monto_abonado = monto_abonado + ?1 WHERE id = ?2",
        params![monto, venta_id],
    )
    .map_err(|e| e.to_string())?;
    audit::registrar(
        &tx,
        ctx.usuario.as_ref(),
        "abono_cliente",
        "venta",
        Some(venta_id),
        &format!("Abono de Bs {:.2} a la venta #{} (saldo restante Bs {:.2})", monto, venta_id, saldo - monto),
    );
    tx.commit().map_err(|e| e.to_string())
}

#[derive(Serialize)]
pub struct PagoVenta {
    pub id: i64,
    pub fecha: String,
    pub monto: f64,
}

pub fn listar_pagos_venta(conn: &Connection, venta_id: i64) -> Result<Vec<PagoVenta>, String> {
    let mut stmt = conn
        .prepare("SELECT id, fecha, monto FROM pagos_venta WHERE venta_id = ?1 ORDER BY fecha ASC")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![venta_id], |row| {
            Ok(PagoVenta { id: row.get(0)?, fecha: row.get(1)?, monto: row.get(2)? })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
    Ok(rows)
}

// ---------------------------------------------------------------------------
// Clientes
// ---------------------------------------------------------------------------

#[derive(Serialize, Deserialize, Clone)]
pub struct Cliente {
    pub id: i64,
    pub nombre: String,
    pub telefono: Option<String>,
    pub carnet: Option<String>,
}

#[derive(Deserialize)]
pub struct NuevoCliente {
    pub nombre: String,
    pub telefono: Option<String>,
    pub carnet: Option<String>,
}

pub fn listar_clientes(conn: &Connection) -> Result<Vec<Cliente>, String> {
    let mut stmt = conn
        .prepare("SELECT id, nombre, telefono, carnet FROM clientes ORDER BY nombre ASC")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            Ok(Cliente { id: row.get(0)?, nombre: row.get(1)?, telefono: row.get(2)?, carnet: row.get(3)? })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
    Ok(rows)
}

pub fn crear_cliente(conn: &Connection, ctx: &Ctx, c: NuevoCliente) -> Result<Cliente, String> {
    let nombre = c.nombre.trim().to_string();
    if nombre.is_empty() {
        return Err("El nombre del cliente es obligatorio".into());
    }
    conn.execute(
        "INSERT INTO clientes (nombre, telefono, carnet) VALUES (?1,?2,?3)",
        params![nombre, c.telefono, c.carnet],
    )
    .map_err(|e| e.to_string())?;
    let id = conn.last_insert_rowid();
    audit::registrar(conn, ctx.usuario.as_ref(), "crear_cliente", "cliente", Some(id), &format!("Registró al cliente {}", nombre));
    Ok(Cliente { id, nombre, telefono: c.telefono, carnet: c.carnet })
}

// ---------------------------------------------------------------------------
// Caja
// ---------------------------------------------------------------------------

#[derive(Serialize)]
pub struct SesionCaja {
    pub id: i64,
    pub usuario_id: i64,
    pub fecha_apertura: String,
    pub monto_apertura: f64,
    pub fecha_cierre: Option<String>,
    pub monto_esperado: Option<f64>,
    pub monto_contado: Option<f64>,
    pub ventas_efectivo: f64,
    pub otros_ingresos: f64,
    pub otros_egresos: f64,
}

fn leer_sesion(conn: &Connection, id: i64) -> Result<SesionCaja, String> {
    conn.query_row(
        "SELECT id, usuario_id, fecha_apertura, monto_apertura, fecha_cierre, monto_esperado, monto_contado
         FROM caja_sesiones WHERE id = ?1",
        params![id],
        |r| {
            Ok(SesionCaja {
                id: r.get(0)?,
                usuario_id: r.get(1)?,
                fecha_apertura: r.get(2)?,
                monto_apertura: r.get(3)?,
                fecha_cierre: r.get(4)?,
                monto_esperado: r.get(5)?,
                monto_contado: r.get(6)?,
                ventas_efectivo: 0.0,
                otros_ingresos: 0.0,
                otros_egresos: 0.0,
            })
        },
    )
    .map_err(|_| "Caja no encontrada".to_string())
    .map(|mut s| {
        s.ventas_efectivo = conn
            .query_row(
                "SELECT COALESCE(SUM(monto_abonado),0) FROM ventas WHERE caja_sesion_id = ?1 AND metodo_pago = 'efectivo'",
                params![s.id],
                |r| r.get(0),
            )
            .unwrap_or(0.0);
        let (i, e) = super::caja::totales_de_caja(conn, s.id);
        s.otros_ingresos = i;
        s.otros_egresos = e;
        s
    })
}

/// La caja que este usuario dejó abierta (por ejemplo si se cerró la app sin cerrar caja).
pub fn obtener_caja_abierta(conn: &Connection, ctx: &Ctx) -> Result<Option<SesionCaja>, String> {
    let user = ctx.usuario()?;
    let id: Option<i64> = conn
        .query_row(
            "SELECT id FROM caja_sesiones WHERE usuario_id = ?1 AND fecha_cierre IS NULL ORDER BY id DESC LIMIT 1",
            params![user.id],
            |r| r.get(0),
        )
        .ok();
    match id {
        Some(id) => Ok(Some(leer_sesion(conn, id)?)),
        None => Ok(None),
    }
}

pub fn abrir_caja(conn: &Connection, ctx: &Ctx, monto_apertura: f64) -> Result<SesionCaja, String> {
    let user = ctx.usuario()?;
    if monto_apertura < 0.0 {
        return Err("El monto de apertura no puede ser negativo".into());
    }
    if obtener_caja_abierta(conn, ctx)?.is_some() {
        return Err("Ya tienes una caja abierta".into());
    }
    let fecha = Local::now().to_rfc3339();
    conn.execute(
        "INSERT INTO caja_sesiones (usuario_id, fecha_apertura, monto_apertura) VALUES (?1,?2,?3)",
        params![user.id, fecha, monto_apertura],
    )
    .map_err(|e| e.to_string())?;
    let id = conn.last_insert_rowid();
    audit::registrar(conn, Some(user), "abrir_caja", "caja", Some(id), &format!("Abrió caja con Bs {:.2}", monto_apertura));
    leer_sesion(conn, id)
}

pub fn cerrar_caja(conn: &Connection, ctx: &Ctx, caja_sesion_id: i64, monto_contado: f64) -> Result<SesionCaja, String> {
    let user = ctx.usuario()?;
    let sesion = leer_sesion(conn, caja_sesion_id)?;
    if sesion.usuario_id != user.id && user.rol != "admin" {
        return Err("Esta caja pertenece a otro usuario".into());
    }
    if sesion.fecha_cierre.is_some() {
        return Err("Esta caja ya estaba cerrada".into());
    }
    if monto_contado < 0.0 {
        return Err("El monto contado no puede ser negativo".into());
    }
    let efectivo: f64 = conn
        .query_row(
            "SELECT COALESCE(SUM(monto_abonado),0) FROM ventas WHERE caja_sesion_id = ?1 AND metodo_pago = 'efectivo'",
            params![caja_sesion_id],
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;
    let (otros_ing, otros_egr) = super::caja::totales_de_caja(conn, caja_sesion_id);
    let esperado = sesion.monto_apertura + efectivo + otros_ing - otros_egr;
    let fecha = Local::now().to_rfc3339();
    conn.execute(
        "UPDATE caja_sesiones SET fecha_cierre = ?1, monto_esperado = ?2, monto_contado = ?3 WHERE id = ?4",
        params![fecha, esperado, monto_contado, caja_sesion_id],
    )
    .map_err(|e| e.to_string())?;
    let dif = monto_contado - esperado;
    audit::registrar(
        conn,
        Some(user),
        "cerrar_caja",
        "caja",
        Some(caja_sesion_id),
        &format!(
            "Cerró caja #{} · esperado Bs {:.2} · contado Bs {:.2} · {}",
            caja_sesion_id,
            esperado,
            monto_contado,
            if dif.abs() < 0.005 {
                "cuadrada".to_string()
            } else if dif > 0.0 {
                format!("sobrante Bs {:.2}", dif)
            } else {
                format!("faltante Bs {:.2}", -dif)
            }
        ),
    );
    leer_sesion(conn, caja_sesion_id)
}
