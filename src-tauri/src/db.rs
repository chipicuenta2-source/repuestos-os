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

    seed_inicial(conn)?;
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

    // Productos demo (tomados de muestra real de catálogo) solo si el inventario está vacío
    let hay_productos: i64 =
        conn.query_row("SELECT COUNT(*) FROM productos", [], |r| r.get(0))?;
    if hay_productos == 0 {
        let cat_id = |nombre: &str| -> i64 {
            conn.query_row(
                "SELECT id FROM categorias WHERE nombre = ?1",
                rusqlite::params![nombre],
                |r| r.get(0),
            )
            .unwrap_or(1)
        };

        let demo: Vec<(&str, &str, &str, &str, &str, &str, i64, &str, &str, &str, i64, f64, f64)> = vec![
            ("343287", "343287", "AMORTIGUADOR DELANTERO", "AMORTIGUADOR DEL. SUZUKI DEL R/L SAMURAI JIMNY 98-", "WELMET", "TW", cat_id("Suspensión y Dirección"), "Estante 4", "Suspensión Suzuki", "PZA", 2, 140.0, 158.2),
            ("348028", "348028", "AMORTIGUADOR TRASERO", "AMORTIGUADOR TRAS. SUZ ALTO/SPARK/CELERIO 09-", "WELMET", "TW", cat_id("Suspensión y Dirección"), "Estante 4", "Suspensión Suzuki", "PZA", 2, 130.0, 146.9),
            ("GWT-83A", "", "BOMBA DE AGUA", "TOY COROLLA/SPRINTER 4AFE/SAFE89/95", "GMB", "JAPON", cat_id("Refrigeración"), "Estante 1", "Motor Toyota", "PIEZA", 1, 280.0, 316.4),
            ("IXEH20TT", "4711", "BUJIA IRIDIUM", "BUJIA IRIDIUM ROSCA LARGA", "DENSO", "JAPON", cat_id("Eléctrico"), "Estante 7", "Eléctrico", "UNI", 8, 90.0, 101.7),
            ("SK-039A", "SK-039A", "HOMOCINETICO", "HOMOCINETICO SUZUKI 1.3 1.5 M13A M15A Z13DT", "NKA", "KOREA", cat_id("Transmisión y Embrague"), "Estante 5", "Transmisión Suzuki", "PZA", 2, 250.0, 282.5),
            ("17670-77E00.", "W52SE-82", "TERMOSTATO", "TERMOSTATO SUZUKI GRAND VITARA H20/G16A/J20A/M16A/J24", "TAMA", "JAPAN", cat_id("Refrigeración"), "Estante 2", "Refrigeración", "PZA", 1, 90.0, 101.7),
            ("DTX-137L", "", "DISCO DE EMBRAGUE", "TOY3VZ/2TRFE 2SOX160 21X29 HILUX VIGO", "AISIN", "JAPON", cat_id("Transmisión y Embrague"), "Estante 5", "Embrague Toyota", "PIEZA", 1, 930.0, 1050.9),
            ("55810-61M00.", "D2096", "PASTILLA DE FRENO", "PASTILLA SUZUKI DEL. NEW VITARA SX CROSS", "BUREKITEK", "TE", cat_id("Frenos"), "Estante 6", "Frenos Suzuki", "PZA", 1, 140.0, 158.2),
            ("DOT3", "DOT3", "LIQUIDO DE FRENO", "LIQUIDO DE FRENO", "WOLKER", "TW", cat_id("Lubricantes y Líquidos"), "Estante 8", "Líquidos", "PIEZA", 24, 25.0, 28.25),
            ("GOTITA", "", "SUPER GLUE GOTITA", "PEGAMENTO INSTANTANEO", "SUPER GLUE", "TW", cat_id("Accesorios y Consumibles"), "Estante 9", "Consumibles", "PIEZA", 12, 2.0, 2.26),
        ];

        for (codigo, oem, nombre, detalle, marca, procedencia, categoria_id, estante, etiqueta, unidad, stock, precio_venta, precio_facturado) in demo {
            conn.execute(
                "INSERT INTO productos (codigo, oem, nombre, detalle, marca, procedencia, categoria_id, estante, etiqueta, unidad, stock, stock_minimo, precio_venta, precio_facturado, activo)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, 2, ?12, ?13, 1)",
                rusqlite::params![codigo, oem, nombre, detalle, marca, procedencia, categoria_id, estante, etiqueta, unidad, stock, precio_venta, precio_facturado],
            )?;
        }
    }

    Ok(())
}
