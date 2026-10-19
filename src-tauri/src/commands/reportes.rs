use rusqlite::Connection;
use serde::Serialize;

#[derive(Serialize)]
pub struct RentabilidadProducto {
    pub producto_id: i64,
    pub nombre: String,
    pub categoria: Option<String>,
    pub estante: Option<String>,
    pub stock: i64,
    pub cantidad_vendida: i64,
    pub total_vendido: f64,
    pub costo_promedio: Option<f64>,
    pub ganancia_neta: Option<f64>,
    pub ultima_compra: Option<String>,
}

pub fn listar_rentabilidad_productos(conn: &Connection) -> Result<Vec<RentabilidadProducto>, String> {
    let sql = "
        SELECT
            p.id, p.nombre, c.nombre, p.estante, p.stock,
            COALESCE(v.cantidad_vendida, 0),
            COALESCE(v.total_vendido, 0),
            co.costo_promedio,
            co.ultima_compra
        FROM productos p
        LEFT JOIN categorias c ON c.id = p.categoria_id
        LEFT JOIN (
            SELECT producto_id, SUM(cantidad) AS cantidad_vendida, SUM(cantidad * precio_unitario) AS total_vendido
            FROM venta_items GROUP BY producto_id
        ) v ON v.producto_id = p.id
        LEFT JOIN (
            SELECT ci.producto_id,
                   SUM(ci.costo_unitario * ci.cantidad) / SUM(ci.cantidad) AS costo_promedio,
                   MAX(c2.fecha) AS ultima_compra
            FROM compra_items ci
            JOIN compras c2 ON c2.id = ci.compra_id
            GROUP BY ci.producto_id
        ) co ON co.producto_id = p.id
        WHERE p.activo = 1
        ORDER BY p.nombre ASC
    ";
    let mut stmt = conn.prepare(sql).map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            let cantidad_vendida: i64 = row.get(5)?;
            let total_vendido: f64 = row.get(6)?;
            let costo_promedio: Option<f64> = row.get(7)?;
            let ganancia_neta = costo_promedio.map(|cp| total_vendido - (cantidad_vendida as f64 * cp));
            Ok(RentabilidadProducto {
                producto_id: row.get(0)?,
                nombre: row.get(1)?,
                categoria: row.get(2)?,
                estante: row.get(3)?,
                stock: row.get(4)?,
                cantidad_vendida,
                total_vendido,
                costo_promedio,
                ganancia_neta,
                ultima_compra: row.get(8)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
    Ok(rows)
}

#[derive(Serialize)]
pub struct ResumenGeneral {
    pub total_cobrado_creditos: f64,
    pub total_por_cobrar: f64,
    pub total_por_pagar: f64,
    pub balance: f64,
}

pub fn resumen_general(conn: &Connection) -> Result<ResumenGeneral, String> {
    let total_cobrado_creditos: f64 = conn
        .query_row("SELECT COALESCE(SUM(monto),0) FROM pagos_venta", [], |r| r.get(0))
        .map_err(|e| e.to_string())?;
    let total_por_cobrar: f64 = conn
        .query_row(
            "SELECT COALESCE(SUM(monto_total - monto_abonado),0) FROM ventas WHERE es_credito = 1",
            [],
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;
    let total_por_pagar: f64 = conn
        .query_row(
            "SELECT COALESCE(SUM(CASE WHEN tipo='compra_credito' THEN monto ELSE -monto END),0) FROM movimientos_proveedor",
            [],
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;
    Ok(ResumenGeneral {
        total_cobrado_creditos,
        total_por_cobrar,
        total_por_pagar,
        balance: total_por_cobrar - total_por_pagar,
    })
}
