use rusqlite::{Connection, Result};
use std::path::PathBuf;

pub fn conectar(app_data_dir: PathBuf) -> Result<Connection> {
    let _ = std::fs::create_dir_all(&app_data_dir);
    let mut ruta = app_data_dir;
    ruta.push("repuestos_pos.sqlite");
    Connection::open(ruta)
}

fn columna_existe(conn: &Connection, tabla: &str, columna: &str) -> bool {
    let sql = format!("PRAGMA table_info({})", tabla);
    let mut stmt = conn.prepare(&sql).unwrap();
    let existe = stmt
        .query_map([], |row| row.get::<_, String>(1))
        .unwrap()
        .filter_map(|r| r.ok())
        .any(|nombre| nombre == columna);
    existe
}

pub fn init_db(conn: &Connection) -> Result<()> {
    conn.execute_batch(
        "
        PRAGMA foreign_keys = ON;

        CREATE TABLE IF NOT EXISTS usuarios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL,
            usuario TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            rol TEXT NOT NULL CHECK (rol IN ('admin','cajero')),
            activo INTEGER NOT NULL DEFAULT 1
        );

        CREATE TABLE IF NOT EXISTS categorias (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL UNIQUE
        );

        CREATE TABLE IF NOT EXISTS productos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            codigo TEXT,
            oem TEXT,
            nombre TEXT NOT NULL,
            detalle TEXT,
            marca TEXT,
            procedencia TEXT,
            categoria_id INTEGER,
            estante TEXT,
            etiqueta TEXT,
            unidad TEXT DEFAULT 'PIEZA',
            stock INTEGER NOT NULL DEFAULT 0,
            stock_minimo INTEGER NOT NULL DEFAULT 2,
            precio_venta REAL NOT NULL DEFAULT 0,
            precio_facturado REAL NOT NULL DEFAULT 0,
            imagen TEXT,
            activo INTEGER NOT NULL DEFAULT 1,
            FOREIGN KEY (categoria_id) REFERENCES categorias(id)
        );

        CREATE TABLE IF NOT EXISTS proveedores (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL,
            categoria TEXT,
            telefono TEXT
        );

        CREATE TABLE IF NOT EXISTS movimientos_proveedor (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            proveedor_id INTEGER NOT NULL,
            tipo TEXT NOT NULL CHECK (tipo IN ('compra_credito','pago')),
            monto REAL NOT NULL,
            fecha TEXT NOT NULL,
            descripcion TEXT,
            FOREIGN KEY (proveedor_id) REFERENCES proveedores(id)
        );

        CREATE TABLE IF NOT EXISTS compras (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            proveedor_id INTEGER NOT NULL,
            fecha TEXT NOT NULL,
            es_credito INTEGER NOT NULL DEFAULT 0,
            monto_total REAL NOT NULL,
            monto_abonado REAL NOT NULL DEFAULT 0,
            FOREIGN KEY (proveedor_id) REFERENCES proveedores(id)
        );

        CREATE TABLE IF NOT EXISTS compra_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            compra_id INTEGER NOT NULL,
            producto_id INTEGER NOT NULL,
            cantidad INTEGER NOT NULL,
            costo_unitario REAL NOT NULL,
            FOREIGN KEY (compra_id) REFERENCES compras(id),
            FOREIGN KEY (producto_id) REFERENCES productos(id)
        );

        CREATE TABLE IF NOT EXISTS clientes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL,
            telefono TEXT,
            carnet TEXT
        );

        CREATE TABLE IF NOT EXISTS caja_sesiones (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            usuario_id INTEGER NOT NULL,
            fecha_apertura TEXT NOT NULL,
            monto_apertura REAL NOT NULL,
            fecha_cierre TEXT,
            monto_esperado REAL,
            monto_contado REAL,
            FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
        );

        CREATE TABLE IF NOT EXISTS movimientos_caja (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            fecha TEXT NOT NULL,
            tipo TEXT NOT NULL,
            concepto TEXT NOT NULL,
            monto REAL NOT NULL,
            usuario_id INTEGER NOT NULL,
            caja_sesion_id INTEGER,
            registrado TEXT NOT NULL,
            FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
        );
        CREATE INDEX IF NOT EXISTS idx_mov_caja_fecha ON movimientos_caja(fecha);

        CREATE TABLE IF NOT EXISTS ventas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            caja_sesion_id INTEGER NOT NULL,
            usuario_id INTEGER NOT NULL,
            cliente_id INTEGER,
            fecha TEXT NOT NULL,
            es_credito INTEGER NOT NULL DEFAULT 0,
            es_facturado INTEGER NOT NULL DEFAULT 0,
            metodo_pago TEXT NOT NULL DEFAULT 'efectivo',
            monto_total REAL NOT NULL,
            monto_abonado REAL NOT NULL DEFAULT 0,
            nombre_comprador TEXT,
            FOREIGN KEY (caja_sesion_id) REFERENCES caja_sesiones(id),
            FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
            FOREIGN KEY (cliente_id) REFERENCES clientes(id)
        );

        CREATE TABLE IF NOT EXISTS venta_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            venta_id INTEGER NOT NULL,
            producto_id INTEGER NOT NULL,
            cantidad INTEGER NOT NULL,
            precio_unitario REAL NOT NULL,
            FOREIGN KEY (venta_id) REFERENCES ventas(id),
            FOREIGN KEY (producto_id) REFERENCES productos(id)
        );

        CREATE TABLE IF NOT EXISTS pagos_venta (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            venta_id INTEGER NOT NULL,
            fecha TEXT NOT NULL,
            monto REAL NOT NULL,
            FOREIGN KEY (venta_id) REFERENCES ventas(id)
        );

        CREATE TABLE IF NOT EXISTS auditoria (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            fecha TEXT NOT NULL,
            usuario_id INTEGER,
            usuario_nombre TEXT,
            accion TEXT NOT NULL,
            entidad TEXT,
            entidad_id INTEGER,
            detalle TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_auditoria_fecha ON auditoria(fecha);
        CREATE INDEX IF NOT EXISTS idx_auditoria_usuario ON auditoria(usuario_id);

        CREATE TABLE IF NOT EXISTS licencia (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            hardware_id TEXT NOT NULL,
            clave_activacion TEXT,
            fecha_activacion TEXT NOT NULL,
            intentos_fallidos INTEGER NOT NULL DEFAULT 0,
            bloqueado_hasta TEXT
        );
        ",
    )?;

    // --- Migraciones suaves por si se agregan columnas en el futuro ---
    if !columna_existe(conn, "productos", "oem") {
        conn.execute("ALTER TABLE productos ADD COLUMN oem TEXT", [])?;
    }
    if !columna_existe(conn, "productos", "estante") {
        conn.execute("ALTER TABLE productos ADD COLUMN estante TEXT", [])?;
    }
    if !columna_existe(conn, "productos", "etiqueta") {
        conn.execute("ALTER TABLE productos ADD COLUMN etiqueta TEXT", [])?;
    }
    if !columna_existe(conn, "productos", "precio_facturado") {
        conn.execute(
            "ALTER TABLE productos ADD COLUMN precio_facturado REAL NOT NULL DEFAULT 0",
            [],
        )?;
    }
    if !columna_existe(conn, "ventas", "es_facturado") {
        conn.execute(
            "ALTER TABLE ventas ADD COLUMN es_facturado INTEGER NOT NULL DEFAULT 0",
            [],
        )?;
    }

    if !columna_existe(conn, "productos", "costo") {
        conn.execute("ALTER TABLE productos ADD COLUMN costo REAL NOT NULL DEFAULT 0", [])?;
    }

    seed_inicial(conn)?;
    cargar_catalogo_ryn(conn)?;
    Ok(())
}

fn seed_inicial(conn: &Connection) -> Result<()> {
    // Usuario admin por defecto
    let hay_usuarios: i64 =
        conn.query_row("SELECT COUNT(*) FROM usuarios", [], |r| r.get(0))?;
    if hay_usuarios == 0 {
        let hash = bcrypt::hash("admin123", bcrypt::DEFAULT_COST).unwrap();
        conn.execute(
            "INSERT INTO usuarios (nombre, usuario, password_hash, rol, activo) VALUES (?1, 'admin', ?2, 'admin', 1)",
            rusqlite::params!["Administrador", hash],
        )?;
    }

    // Categorías por defecto (organizadas por sistema del vehículo)
    let hay_categorias: i64 =
        conn.query_row("SELECT COUNT(*) FROM categorias", [], |r| r.get(0))?;
    if hay_categorias == 0 {
        let categorias = [
            "Motor",
            "Suspensión y Dirección",
            "Frenos",
            "Transmisión y Embrague",
            "Eléctrico",
            "Refrigeración",
            "Lubricantes y Líquidos",
            "Accesorios y Consumibles",
        ];
        for c in categorias {
            conn.execute(
                "INSERT OR IGNORE INTO categorias (nombre) VALUES (?1)",
                rusqlite::params![c],
            )?;
        }
    }

    Ok(())
}

#[derive(serde::Deserialize)]
struct ItemCatalogo {
    codigo: String,
    oem: String,
    nombre: String,
    detalle: String,
    marca: String,
    procedencia: String,
    categoria: String,
    unidad: String,
    stock: i64,
    costo: f64,
    precio_venta: f64,
    precio_facturado: f64,
}

/// Inventario inicial de RyN Importadora (Excel "Inventario general 2026").
/// Se carga una sola vez: reemplaza los productos de muestra mientras todavía no haya
/// ventas ni compras registradas. Si ya se trabajó con el sistema, no toca nada.
fn cargar_catalogo_ryn(conn: &Connection) -> Result<()> {
    conn.execute(
        "CREATE TABLE IF NOT EXISTS ajustes (clave TEXT PRIMARY KEY, valor TEXT)",
        [],
    )?;
    let ya: i64 = conn.query_row(
        "SELECT COUNT(*) FROM ajustes WHERE clave = 'catalogo_ryn_v1'",
        [],
        |r| r.get(0),
    )?;
    if ya > 0 {
        return Ok(());
    }
    let ventas: i64 = conn.query_row("SELECT COUNT(*) FROM ventas", [], |r| r.get(0))?;
    let compras: i64 = conn.query_row("SELECT COUNT(*) FROM compras", [], |r| r.get(0))?;
    if ventas == 0 && compras == 0 {
        let items: Vec<ItemCatalogo> = serde_json::from_str(include_str!("catalogo.json"))
            .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
        let tx = conn.unchecked_transaction()?;
        tx.execute("DELETE FROM productos", [])?;
        for i in items {
            tx.execute(
                "INSERT OR IGNORE INTO categorias (nombre) VALUES (?1)",
                rusqlite::params![i.categoria],
            )?;
            let cat: i64 = tx.query_row(
                "SELECT id FROM categorias WHERE nombre = ?1",
                rusqlite::params![i.categoria],
                |r| r.get(0),
            )?;
            tx.execute(
                "INSERT INTO productos (codigo, oem, nombre, detalle, marca, procedencia, categoria_id, estante, etiqueta, unidad, stock, stock_minimo, precio_venta, precio_facturado, costo, activo)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, '', '', ?8, ?9, 2, ?10, ?11, ?12, 1)",
                rusqlite::params![i.codigo, i.oem, i.nombre, i.detalle, i.marca, i.procedencia, cat, i.unidad, i.stock, i.precio_venta, i.precio_facturado, i.costo],
            )?;
        }
        tx.execute("INSERT INTO ajustes (clave, valor) VALUES ('catalogo_ryn_v1', 'ok')", [])?;
        tx.commit()?;
    }
    Ok(())
}
