# REPUESTOS OS — Sistema de venta e inventario (repuestos automotrices)

Sistema de punto de venta e inventario offline para tiendas de repuestos automotrices (autopartes), con
ubicación física por estante/etiqueta, búsqueda por código OEM, y doble precio (con/sin factura).
Construido con la misma arquitectura de CONTROLA (tienda de accesorios): Tauri v2 + React/Vite + Rust/rusqlite,
100% offline, para Windows y Mac.

## Funcionalidades

- **Login** con roles Admin y Cajero (usuario `admin` / contraseña `admin123` por defecto).
- **Apertura y cierre de caja** con arqueo (monto esperado vs. monto contado).
- **Punto de venta**:
  - Catálogo por categorías del sistema del vehículo (Motor, Suspensión y Dirección, Frenos, etc.).
  - Búsqueda que cruza nombre, código interno, código OEM, detalle de compatibilidad y marca a la vez.
  - Cada producto muestra en qué **estante** está y bajo qué **etiqueta**.
  - Toggle **Con factura / Sin factura** que cambia el precio cobrado en cada línea.
  - Ticket con desglose precio unitario × cantidad = subtotal, cantidad editable y botón para quitar línea.
  - Métodos de pago Efectivo y QR, ventas a crédito con cliente y abono inicial.
- **Inventario** (solo Admin): CRUD completo con código, OEM, marca, procedencia, categoría, estante, etiqueta,
  unidad, stock, stock mínimo y doble precio (venta / facturado). Gestión de categorías.
- **Proveedores**: registro, compras con detalle por producto (incrementa stock), cuenta corriente con saldo,
  pagos a proveedor.
- **Clientes / Deudas**: Cuentas por Cobrar (clientes a crédito, con abonos) y Cuentas por Pagar (proveedores),
  ambas con búsqueda.
- **Reportes**: ganancia neta real (comparando precio de venta contra costo promedio ponderado de compras,
  nunca un estimado inventado), más/menos vendidos, tabla de rentabilidad e inventario con fecha de última
  compra, resumen general del sistema (cobrado, por cobrar, por pagar, balance), exportación a PDF.
- **Usuarios** (solo Admin): crear cajeros/admins, activar/desactivar.
- **Moneda: Bs** (bolivianos) en toda la interfaz.
- **Licencia atada al equipo**: ver sección de seguridad abajo.

## Requisitos para compilar

- [Node.js](https://nodejs.org/) 18+
- [Rust](https://www.rust-lang.org/tools/install) (vía `rustup`)
- [Tauri CLI](https://tauri.app) (se instala con `npm install`, incluido en `package.json`)
- **Windows**: Visual Studio Build Tools (carga de trabajo "Desarrollo para escritorio con C++")
- **Mac**: Xcode Command Line Tools (`xcode-select --install`)

## Instalación y desarrollo

```bash
npm install
npm run tauri dev
```

`npm run dev` (sin Tauri) también sirve para iterar el diseño en el navegador con datos simulados en
memoria — no se conecta a la base de datos real ni requiere compilar Rust.

## Compilar instalador

```bash
npm run tauri build
```

Genera el instalador en `src-tauri/target/release/bundle/` (`.msi`/`.exe` en Windows vía NSIS,
`.app`/`.dmg` en Mac).

## Seguridad: licencia atada al equipo

El sistema no usa servidor ni internet para validar la licencia — todo es local y offline.

1. Al primer arranque, la app calcula una huella de hardware (`machine-uid` + SHA-256) y la guarda en
   la base de datos. Esto arranca el contador de intentos fallidos desde el primer arranque, no desde
   el primer intento de activación — así, reinstalar sin borrar los datos no resetea el contador.
2. La pantalla de activación muestra un **"Código de este equipo"** (derivado de esa huella, no es secreto,
   se comparte a propósito).
3. El dueño del sistema genera una clave de activación atada a ese código exacto:
   ```bash
   node herramientas/generar-clave.mjs <codigo-de-equipo> "Nombre del cliente"
   ```
4. La clave tiene el formato `REPUESTOS-<código-de-equipo>-<checksum>`. El checksum es un
   HMAC-SHA256 calculado con una frase secreta (`SECRET`) que debe ser **idéntica** en:
   - `src-tauri/src/licencia.rs` (constante `SECRET`)
   - `herramientas/generar-clave.mjs` (constante `SECRET`)

   **Antes de repartir el sistema a un cliente real, cambia `SECRET` en ambos archivos por una frase
   propia, larga y aleatoria.** Este paquete trae un secreto genérico de ejemplo.
5. Una clave generada para un equipo falla en cualquier otro equipo (el código de equipo embebido no
   coincide), aunque se copie el instalador o la carpeta ya instalada.
6. Después de **5 intentos fallidos**, el equipo queda bloqueado por **24 horas**.
7. Puedes recompilar el sistema cuantas veces quieras sin afectar instalaciones ya activadas: la
   activación vive en la base de datos local de cada instalación, no en el código.

**Límite honesto:** ningún esquema 100% offline es inquebrantable ante ingeniería inversa avanzada
(desensamblar el binario, parchear la verificación). Esto bloquea la copia casual del instalador o de
la carpeta instalada, que es el escenario real de piratería más común en este tipo de negocio.

## Estructura del proyecto

```
src/                    Frontend React
  api.js                Capa de API dual (Tauri / navegador con datos simulados)
  components/
    views/              Vistas principales (POS, Productos, Proveedores, Deudas, Reportes, Usuarios)
    modals/             Modales (formularios, pagos, compras, nota de venta)
src-tauri/
  src/
    main.rs             Punto de entrada, registro de comandos
    db.rs               Esquema de base de datos + migraciones + datos semilla
    licencia.rs          Módulo de licencia atada al equipo
    commands/           Comandos de Tauri por dominio (productos, ventas, proveedores, usuarios, reportes)
herramientas/
  generar-clave.mjs      Script para generar claves de activación (no se compila en la app)
```

## Datos de ejemplo

El inventario incluye 10 productos de muestra tomados de un catálogo real de importación de
repuestos, para poder probar el sistema de inmediato. Bórralos desde Inventario cuando cargues tu
catálogo real.

---

## Historial de actividad (auditoría)

Cada acción importante queda registrada con **quién, cuándo y qué**: inicios de sesión (y fallidos), apertura/cierre de caja, ventas, altas/ediciones/bajas de productos (con el antes → después, ej. `precio venta: 100.00 → 120.00`), compras, pagos a proveedores, abonos de clientes, usuarios, licencia y cambios de red. El administrador lo ve en **Historial** (filtros por usuario, acción, fechas y texto; exporta a PDF). Los registros no se pueden editar ni borrar desde la app.

El cajero tiene **Mis ventas**: solo ve las ventas que él hizo (lo garantiza el servidor, no solo la pantalla). El admin ve **Ventas** de todos, con filtro por cajero.

## Trabajo en red local (varias computadoras)

Menú **Red** (admin) o el enlace "⚙ Configuración de red" en la pantalla de acceso:

| Modo | Qué hace |
|---|---|
| Independiente | Una sola PC con su base de datos (por defecto). |
| Servidor | Esta PC guarda los datos y atiende a las demás (puerto 7878). Muestra su IP para escribirla en los clientes. |
| Cliente | Se conecta a la PC servidor; mismos usuarios, productos y ventas. |

Pasos: 1) En la PC principal → Servidor → Guardar y reiniciar; anota la IP mostrada. 2) En cada otra PC → Cliente → escribe la IP → Probar conexión → Guardar y reiniciar. 3) Cada persona entra con su usuario y rol.

Notas:
- La PC servidor debe estar encendida mientras las demás trabajan; los datos y la licencia viven ahí (activa la licencia en el servidor).
- Windows: al primer arranque como servidor permite el firewall en redes privadas. macOS: acepta el permiso de red local.
- La comunicación en la red del local es HTTP simple; úsalo solo en una red de confianza.
- Los precios los decide el servidor; el stock se valida al vender, así que dos cajas no pueden vender la última unidad a la vez.
- Desactivar un usuario o cambiar su rol surte efecto de inmediato en todas las PCs.

## Instalador para Windows
Opción A (en una PC con Windows): instala Node, Rust y las "Build Tools de Visual Studio (C++)", abre una terminal en la carpeta y ejecuta `npm install` y `npm run tauri build`. Los instaladores quedan en `src-tauri\target\release\bundle\nsis\` (.exe) y `...\msi\`.
Opción B (desde la Mac, sin Windows): sube el proyecto a un repositorio privado de GitHub y ejecuta la acción "Compilar Windows" (pestaña Actions → Run workflow). Al terminar, descarga el instalador desde "Artifacts".
La clave de licencia se genera igual: el código del equipo de la PC Windows con `node herramientas/generar-clave.mjs`.


## Inventario RyN Importadora
Al abrir por primera vez, el sistema carga el "Inventario general RYN 2026" (179 productos, con costo de llegada, precio sin factura y precio con factura). Reemplaza los productos de muestra, y solo si todavía no hay ventas ni compras registradas. Los datos están en `src-tauri/src/catalogo.json`. El costo de llegada se usa en Reportes para la ganancia de productos sin compras registradas. Estante y etiqueta quedan vacíos para llenarlos en Inventario.

## Otros ingresos y egresos de caja
Menú **Ingresos / Egresos** (admin y cajero): fecha, concepto y monto. Los ingresos suman a la caja y los egresos restan. Si son de hoy y el usuario tiene su caja abierta, entran en el cierre de esa caja (esperado = apertura + ventas en efectivo + ingresos − egresos). El cajero solo registra con fecha de hoy y ve los suyos; el administrador puede usar fechas pasadas, ver los de todos y eliminar (salvo los de cajas ya cerradas). Todo queda en el Historial.
