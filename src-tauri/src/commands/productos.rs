use super::Ctx;
use crate::audit;
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone)]
pub struct Producto {
    pub id: i64,
    pub codigo: Option<String>,
    pub oem: Option<String>,
    pub nombre: String,
    pub detalle: Option<String>,
    pub marca: Option<String>,
    pub procedencia: Option<String>,
    pub categoria_id: Option<i64>,
    pub categoria_nombre: Option<String>,
    pub estante: Option<String>,
    pub etiqueta: Option<String>,
    pub unidad: Option<String>,
    pub stock: i64,
    pub stock_minimo: i64,
    pub precio_venta: f64,
    pub precio_facturado: f64,
    pub imagen: Option<String>,
}

#[derive(Deserialize, Clone)]
pub struct NuevoProducto {
    pub codigo: Option<String>,
    pub oem: Option<String>,
    pub nombre: String,
    pub detalle: Option<String>,
    pub marca: Option<String>,
    pub procedencia: Option<String>,
    pub categoria_id: Option<i64>,
    pub estante: Option<String>,
    pub etiqueta: Option<String>,
    pub unidad: Option<String>,
    pub stock: i64,
    pub stock_minimo: i64,
    pub precio_venta: f64,
    pub precio_facturado: f64,
    pub imagen: Option<String>,
}

const SELECT_BASE: &str = "
    SELECT p.id, p.codigo, p.oem, p.nombre, p.detalle, p.marca, p.procedencia,
           p.categoria_id, c.nombre, p.estante, p.etiqueta, p.unidad,
           p.stock, p.stock_minimo, p.precio_venta, p.precio_facturado, p.imagen
    FROM productos p
    LEFT JOIN categorias c ON c.id = p.categoria_id
    WHERE p.activo = 1
";

fn map_row(row: &rusqlite::Row) -> rusqlite::Result<Producto> {
    Ok(Producto {
        id: row.get(0)?,
        codigo: row.get(1)?,
        oem: row.get(2)?,
        nombre: row.get(3)?,
        detalle: row.get(4)?,
        marca: row.get(5)?,
        procedencia: row.get(6)?,
        categoria_id: row.get(7)?,
        categoria_nombre: row.get(8)?,
        estante: row.get(9)?,
        etiqueta: row.get(10)?,
        unidad: row.get(11)?,
        stock: row.get(12)?,
        stock_minimo: row.get(13)?,
        precio_venta: row.get(14)?,
        precio_facturado: row.get(15)?,
        imagen: row.get(16)?,
    })
}

pub fn obtener_producto(conn: &Connection, id: i64) -> Result<Producto, String> {
    let sql = format!("{} AND p.id = ?1", SELECT_BASE);
    conn.query_row(&sql, params![id], map_row)
        .map_err(|_| "Producto no encontrado".to_string())
}

pub fn listar_productos(conn: &Connection) -> Result<Vec<Producto>, String> {
    let sql = format!("{} ORDER BY p.nombre ASC", SELECT_BASE);
    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], map_row)
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
    Ok(rows)
}

// Búsqueda que cruza nombre + código + OEM + detalle + marca a la vez (clave para repuestos,
// donde un mismo nombre genérico se repite para piezas de vehículos distintos).
pub fn buscar_productos(conn: &Connection, texto: &str) -> Result<Vec<Producto>, String> {
    let patron = format!("%{}%", texto.trim().to_lowercase());
    let sql = format!(
        "{} AND (
            lower(p.nombre) LIKE ?1 OR
            lower(COALESCE(p.codigo,'')) LIKE ?1 OR
            lower(COALESCE(p.oem,'')) LIKE ?1 OR
            lower(COALESCE(p.detalle,'')) LIKE ?1 OR
            lower(COALESCE(p.marca,'')) LIKE ?1
        ) ORDER BY p.nombre ASC",
        SELECT_BASE
    );
    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![patron], map_row)
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
    Ok(rows)
}

fn validar(p: &NuevoProducto) -> Result<(), String> {
    if p.nombre.trim().is_empty() {
        return Err("El nombre del producto es obligatorio".into());
    }
    if p.stock < 0 || p.stock_minimo < 0 {
        return Err("El stock no puede ser negativo".into());
    }
    if p.precio_venta < 0.0 || p.precio_facturado < 0.0 {
        return Err("Los precios no pueden ser negativos".into());
    }
    Ok(())
}

pub fn crear_producto(conn: &Connection, ctx: &Ctx, p: NuevoProducto) -> Result<Producto, String> {
    validar(&p)?;
    conn.execute(
        "INSERT INTO productos
            (codigo, oem, nombre, detalle, marca, procedencia, categoria_id, estante, etiqueta, unidad, stock, stock_minimo, precio_venta, precio_facturado, imagen, activo)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,1)",
        params![
            p.codigo, p.oem, p.nombre.trim(), p.detalle, p.marca, p.procedencia, p.categoria_id,
            p.estante, p.etiqueta, p.unidad, p.stock, p.stock_minimo, p.precio_venta,
            p.precio_facturado, p.imagen
        ],
    )
    .map_err(|e| e.to_string())?;
    let id = conn.last_insert_rowid();
    audit::registrar(
        conn,
        ctx.usuario.as_ref(),
        "crear_producto",
        "producto",
        Some(id),
        &format!(
            "Creó el producto {} · stock {} · venta Bs {:.2} · facturado Bs {:.2} · {}",
            p.nombre.trim(),
            p.stock,
            p.precio_venta,
            p.precio_facturado,
            p.estante.clone().unwrap_or_default()
        ),
    );
    obtener_producto(conn, id)
}

fn norm(o: &Option<String>) -> String {
    o.as_ref().map(|s| s.trim().to_string()).unwrap_or_default()
}

fn cambio_txt(v: &mut Vec<String>, campo: &str, a: &str, b: &str) {
    if a != b {
        let ver = |s: &str| if s.is_empty() { "—".to_string() } else { s.to_string() };
        v.push(format!("{}: {} → {}", campo, ver(a), ver(b)));
    }
}

fn cambio_num(v: &mut Vec<String>, campo: &str, a: f64, b: f64, dec: usize) {
    if (a - b).abs() > f64::EPSILON {
        v.push(format!("{}: {:.*} → {:.*}", campo, dec, a, dec, b));
    }
}

pub fn actualizar_producto(conn: &Connection, ctx: &Ctx, id: i64, p: NuevoProducto) -> Result<(), String> {
    validar(&p)?;
    let antes = obtener_producto(conn, id)?;

    conn.execute(
        "UPDATE productos SET codigo=?1, oem=?2, nombre=?3, detalle=?4, marca=?5, procedencia=?6,
            categoria_id=?7, estante=?8, etiqueta=?9, unidad=?10, stock=?11, stock_minimo=?12,
            precio_venta=?13, precio_facturado=?14, imagen=?15
         WHERE id = ?16",
        params![
            p.codigo, p.oem, p.nombre.trim(), p.detalle, p.marca, p.procedencia, p.categoria_id,
            p.estante, p.etiqueta, p.unidad, p.stock, p.stock_minimo, p.precio_venta,
            p.precio_facturado, p.imagen, id
        ],
    )
    .map_err(|e| e.to_string())?;

    let mut c: Vec<String> = Vec::new();
    cambio_txt(&mut c, "nombre", antes.nombre.trim(), p.nombre.trim());
    cambio_txt(&mut c, "código", &norm(&antes.codigo), &norm(&p.codigo));
    cambio_txt(&mut c, "OEM", &norm(&antes.oem), &norm(&p.oem));
    cambio_txt(&mut c, "detalle", &norm(&antes.detalle), &norm(&p.detalle));
    cambio_txt(&mut c, "marca", &norm(&antes.marca), &norm(&p.marca));
    cambio_txt(&mut c, "procedencia", &norm(&antes.procedencia), &norm(&p.procedencia));
    cambio_txt(&mut c, "estante", &norm(&antes.estante), &norm(&p.estante));
    cambio_txt(&mut c, "etiqueta", &norm(&antes.etiqueta), &norm(&p.etiqueta));
    cambio_txt(&mut c, "unidad", &norm(&antes.unidad), &norm(&p.unidad));
    if antes.categoria_id != p.categoria_id {
        c.push("categoría cambiada".into());
    }
    cambio_num(&mut c, "stock", antes.stock as f64, p.stock as f64, 0);
    cambio_num(&mut c, "stock mínimo", antes.stock_minimo as f64, p.stock_minimo as f64, 0);
    cambio_num(&mut c, "precio venta", antes.precio_venta, p.precio_venta, 2);
    cambio_num(&mut c, "precio facturado", antes.precio_facturado, p.precio_facturado, 2);

    let detalle = if c.is_empty() {
        format!("Guardó {} sin cambios", antes.nombre)
    } else {
        format!("{} — {}", antes.nombre, c.join("; "))
    };
    audit::registrar(conn, ctx.usuario.as_ref(), "editar_producto", "producto", Some(id), &detalle);
    Ok(())
}

pub fn eliminar_producto(conn: &Connection, ctx: &Ctx, id: i64) -> Result<(), String> {
    let p = obtener_producto(conn, id)?;
    conn.execute("UPDATE productos SET activo = 0 WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    audit::registrar(
        conn,
        ctx.usuario.as_ref(),
        "baja_producto",
        "producto",
        Some(id),
        &format!("Dio de baja {} (stock al momento: {})", p.nombre, p.stock),
    );
    Ok(())
}

// --- Categorías ---

#[derive(Serialize, Deserialize, Clone)]
pub struct Categoria {
    pub id: i64,
    pub nombre: String,
}

pub fn listar_categorias(conn: &Connection) -> Result<Vec<Categoria>, String> {
    let mut stmt = conn
        .prepare("SELECT id, nombre FROM categorias ORDER BY nombre ASC")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| Ok(Categoria { id: row.get(0)?, nombre: row.get(1)? }))
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
    Ok(rows)
}

pub fn crear_categoria(conn: &Connection, ctx: &Ctx, nombre: &str) -> Result<Categoria, String> {
    let nombre = nombre.trim().to_string();
    if nombre.is_empty() {
        return Err("El nombre de la categoría es obligatorio".into());
    }
    conn.execute("INSERT INTO categorias (nombre) VALUES (?1)", params![nombre])
        .map_err(|_| "Ya existe una categoría con ese nombre".to_string())?;
    let id = conn.last_insert_rowid();
    audit::registrar(conn, ctx.usuario.as_ref(), "crear_categoria", "categoria", Some(id), &format!("Creó la categoría {}", nombre));
    Ok(Categoria { id, nombre })
}

pub fn eliminar_categoria(conn: &Connection, ctx: &Ctx, id: i64) -> Result<(), String> {
    let en_uso: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM productos WHERE categoria_id = ?1 AND activo = 1",
            params![id],
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;
    if en_uso > 0 {
        return Err(format!("No se puede eliminar: hay {} producto(s) usando esta categoría", en_uso));
    }
    let nombre: String = conn
        .query_row("SELECT nombre FROM categorias WHERE id = ?1", params![id], |r| r.get(0))
        .map_err(|_| "Categoría no encontrada".to_string())?;
    conn.execute("DELETE FROM categorias WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    audit::registrar(conn, ctx.usuario.as_ref(), "eliminar_categoria", "categoria", Some(id), &format!("Eliminó la categoría {}", nombre));
    Ok(())
}
