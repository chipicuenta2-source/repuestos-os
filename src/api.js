import { invoke as tauriInvoke } from "@tauri-apps/api/core";

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

// En la app instalada TODO pasa por un único comando de Rust ("ejecutar"), que decide si lo
// resuelve en este equipo o lo reenvía a la PC servidor (modo red local). Aquí no cambia nada.
async function invokeReal(cmd, args = {}) {
  try {
    return await tauriInvoke("ejecutar", { cmd, args });
  } catch (err) {
    const msg = typeof err === "string" ? err : err?.message || "Error desconocido";
    // La sesión se perdió (usuario desactivado, servidor reiniciado...): la app vuelve al login
    if (msg === "SESION_EXPIRADA" && typeof window !== "undefined") {
      window.dispatchEvent(new Event("sesion-expirada"));
    }
    throw msg;
  }
}
const invoke = isTauri ? invokeReal : null;

// ---------------------------------------------------------------------------
// Modo navegador (sin Tauri compilado): datos simulados en memoria para poder
// iterar el diseño con `npm run dev` sin tocar Rust.
// ---------------------------------------------------------------------------

let mockCategorias = [
  { id: 1, nombre: "Motor" },
  { id: 2, nombre: "Suspensión y Dirección" },
  { id: 3, nombre: "Frenos" },
  { id: 4, nombre: "Transmisión y Embrague" },
  { id: 5, nombre: "Eléctrico" },
  { id: 6, nombre: "Refrigeración" },
  { id: 7, nombre: "Lubricantes y Líquidos" },
  { id: 8, nombre: "Accesorios y Consumibles" },
];

let mockProductos = [
  { id: 1, codigo: "343287", oem: "343287", nombre: "AMORTIGUADOR DELANTERO", detalle: "AMORTIGUADOR DEL. SUZUKI DEL R/L SAMURAI JIMNY 98-", marca: "WELMET", procedencia: "TW", categoria_id: 2, categoria_nombre: "Suspensión y Dirección", estante: "Estante 4", etiqueta: "Suspensión Suzuki", unidad: "PZA", stock: 2, stock_minimo: 2, precio_venta: 140, precio_facturado: 158.2, imagen: null },
  { id: 2, codigo: "348028", oem: "348028", nombre: "AMORTIGUADOR TRASERO", detalle: "AMORTIGUADOR TRAS. SUZ ALTO/SPARK/CELERIO 09-", marca: "WELMET", procedencia: "TW", categoria_id: 2, categoria_nombre: "Suspensión y Dirección", estante: "Estante 4", etiqueta: "Suspensión Suzuki", unidad: "PZA", stock: 2, stock_minimo: 2, precio_venta: 130, precio_facturado: 146.9, imagen: null },
  { id: 3, codigo: "GWT-83A", oem: "", nombre: "BOMBA DE AGUA", detalle: "TOY COROLLA/SPRINTER 4AFE/SAFE89/95", marca: "GMB", procedencia: "JAPON", categoria_id: 6, categoria_nombre: "Refrigeración", estante: "Estante 1", etiqueta: "Motor Toyota", unidad: "PIEZA", stock: 1, stock_minimo: 2, precio_venta: 280, precio_facturado: 316.4, imagen: null },
  { id: 4, codigo: "IXEH20TT", oem: "4711", nombre: "BUJIA IRIDIUM", detalle: "BUJIA IRIDIUM ROSCA LARGA", marca: "DENSO", procedencia: "JAPON", categoria_id: 5, categoria_nombre: "Eléctrico", estante: "Estante 7", etiqueta: "Eléctrico", unidad: "UNI", stock: 8, stock_minimo: 2, precio_venta: 90, precio_facturado: 101.7, imagen: null },
  { id: 5, codigo: "SK-039A", oem: "SK-039A", nombre: "HOMOCINETICO", detalle: "HOMOCINETICO SUZUKI 1.3 1.5 M13A M15A Z13DT", marca: "NKA", procedencia: "KOREA", categoria_id: 4, categoria_nombre: "Transmisión y Embrague", estante: "Estante 5", etiqueta: "Transmisión Suzuki", unidad: "PZA", stock: 2, stock_minimo: 2, precio_venta: 250, precio_facturado: 282.5, imagen: null },
  { id: 6, codigo: "17670-77E00.", oem: "W52SE-82", nombre: "TERMOSTATO", detalle: "TERMOSTATO SUZUKI GRAND VITARA H20/G16A/J20A/M16A/J24", marca: "TAMA", procedencia: "JAPAN", categoria_id: 6, categoria_nombre: "Refrigeración", estante: "Estante 2", etiqueta: "Refrigeración", unidad: "PZA", stock: 1, stock_minimo: 2, precio_venta: 90, precio_facturado: 101.7, imagen: null },
  { id: 7, codigo: "DTX-137L", oem: "", nombre: "DISCO DE EMBRAGUE", detalle: "TOY3VZ/2TRFE 2SOX160 21X29 HILUX VIGO", marca: "AISIN", procedencia: "JAPON", categoria_id: 4, categoria_nombre: "Transmisión y Embrague", estante: "Estante 5", etiqueta: "Embrague Toyota", unidad: "PIEZA", stock: 1, stock_minimo: 2, precio_venta: 930, precio_facturado: 1050.9, imagen: null },
  { id: 8, codigo: "55810-61M00.", oem: "D2096", nombre: "PASTILLA DE FRENO", detalle: "PASTILLA SUZUKI DEL. NEW VITARA SX CROSS", marca: "BUREKITEK", procedencia: "TE", categoria_id: 3, categoria_nombre: "Frenos", estante: "Estante 6", etiqueta: "Frenos Suzuki", unidad: "PZA", stock: 1, stock_minimo: 2, precio_venta: 140, precio_facturado: 158.2, imagen: null },
  { id: 9, codigo: "DOT3", oem: "DOT3", nombre: "LIQUIDO DE FRENO", detalle: "LIQUIDO DE FRENO", marca: "WOLKER", procedencia: "TW", categoria_id: 7, categoria_nombre: "Lubricantes y Líquidos", estante: "Estante 8", etiqueta: "Líquidos", unidad: "PIEZA", stock: 24, stock_minimo: 4, precio_venta: 25, precio_facturado: 28.25, imagen: null },
  { id: 10, codigo: "GOTITA", oem: "", nombre: "SUPER GLUE GOTITA", detalle: "PEGAMENTO INSTANTANEO", marca: "SUPER GLUE", procedencia: "TW", categoria_id: 8, categoria_nombre: "Accesorios y Consumibles", estante: "Estante 9", etiqueta: "Consumibles", unidad: "PIEZA", stock: 12, stock_minimo: 4, precio_venta: 2, precio_facturado: 2.26, imagen: null },
];

let mockProveedores = [
  { id: 1, nombre: "RYN Importaciones", categoria: "Motor", telefono: "70000001", saldo: 450 },
];
let mockMovimientosProveedor = [
  { id: 1, proveedor_id: 1, tipo: "compra_credito", monto: 450, fecha: new Date().toISOString(), descripcion: "Compra #1" },
];

let mockClientes = [
  { id: 1, nombre: "Taller Hermanos Quispe", telefono: "71234567", carnet: "" },
];

let mockUsuarios = [
  { id: 1, nombre: "Administrador", usuario: "admin", rol: "admin", activo: true },
  { id: 2, nombre: "Juan Pérez", usuario: "jperez", rol: "cajero", activo: true },
];

let mockVentas = [];
let mockPagosVenta = [];
let mockCajaSesiones = [];
let mockAuditoria = [];
let mockUsuarioActual = null;
let mockMovCaja = [];
const hoyIso = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
let nextId = { producto: 11, categoria: 9, proveedor: 2, cliente: 2, usuario: 3, venta: 1, caja: 1, evento: 1 };

const wait = (ms = 120) => new Promise((r) => setTimeout(r, ms));

// Auditoría simulada (en la app real la escribe el backend dentro de cada operación)
function logMock(accion, entidad, detalle, usuario = mockUsuarioActual) {
  mockAuditoria.push({
    id: nextId.evento++,
    fecha: new Date().toISOString(),
    usuario_id: usuario ? usuario.id : null,
    usuario_nombre: usuario ? `${usuario.nombre} (${usuario.usuario})` : null,
    accion,
    entidad,
    entidad_id: null,
    detalle,
  });
}

function filtrarProductos(texto) {
  const t = texto.toLowerCase();
  return mockProductos.filter(
    (p) =>
      p.nombre.toLowerCase().includes(t) ||
      (p.codigo || "").toLowerCase().includes(t) ||
      (p.oem || "").toLowerCase().includes(t) ||
      (p.detalle || "").toLowerCase().includes(t) ||
      (p.marca || "").toLowerCase().includes(t)
  );
}

export const api = {
  async login(usuario, password) {
    if (!isTauri) {
      await wait();
      const u = mockUsuarios.find((x) => x.usuario === usuario);
      if (!u || !u.activo || (password !== "admin123" && password !== "1234")) {
        logMock("login_fallido", "usuario", `Usuario: ${usuario}`, null);
        throw "Usuario o contraseña incorrectos";
      }
      mockUsuarioActual = u;
      logMock("login", "usuario", "Inicio de sesión");
      return u;
    }
    return invoke("login", { usuario, password });
  },

  async logout() {
    if (!isTauri) {
      logMock("logout", "usuario", "Cerró sesión");
      mockUsuarioActual = null;
      return;
    }
    return invoke("logout");
  },

  async validarLicencia() {
    if (!isTauri) {
      await wait();
      return { valida: true, activada: true, hardware_id: "demo", codigo_equipo: "DEMO-0000-0000", mensaje: null };
    }
    return invoke("validar_licencia");
  },

  async activarLicencia(clave) {
    if (!isTauri) {
      await wait();
      return { valida: true, activada: true, hardware_id: "demo", codigo_equipo: "DEMO-0000-0000", mensaje: "Licencia activada" };
    }
    return invoke("activar_licencia", { clave });
  },

  async obtenerCajaAbierta() {
    if (!isTauri) {
      await wait(40);
      return mockCajaSesiones.find((s) => s.usuario_id === mockUsuarioActual?.id && !s.fecha_cierre) || null;
    }
    return invoke("obtener_caja_abierta");
  },

  // El usuario de la caja lo decide el servidor según la sesión; ya no se envía desde aquí.
  async abrirCaja(montoApertura) {
    if (!isTauri) {
      await wait();
      const sesion = {
        id: nextId.caja++,
        usuario_id: mockUsuarioActual?.id,
        fecha_apertura: new Date().toISOString(),
        monto_apertura: montoApertura,
        fecha_cierre: null,
        monto_esperado: null,
        monto_contado: null,
        ventas_efectivo: 0, ventas_qr: 0, cobros_efectivo: 0, cobros_qr: 0, otros_ingresos: 0, otros_egresos: 0,
      };
      mockCajaSesiones.push(sesion);
      logMock("abrir_caja", "caja", `Abrió caja con Bs ${montoApertura.toFixed(2)}`);
      return sesion;
    }
    return invoke("abrir_caja", { montoApertura });
  },

  async cerrarCaja(cajaSesionId, montoContado) {
    if (!isTauri) {
      await wait();
      const sesion = mockCajaSesiones.find((s) => s.id === cajaSesionId);
      const abonosDe = (v) => mockPagosVenta.filter((p) => p.venta_id === v.id).reduce((a, p) => a + p.monto, 0);
      const ventasDe = (m) => mockVentas
        .filter((v) => v.caja_sesion_id === cajaSesionId && v.metodo_pago === m)
        .reduce((acc, v) => acc + v.monto_abonado - abonosDe(v), 0);
      const cobrosDe = (m) => mockPagosVenta
        .filter((p) => p.caja_sesion_id === cajaSesionId && p.metodo_pago === m)
        .reduce((a, p) => a + p.monto, 0);
      const totalEfectivo = ventasDe("efectivo") + cobrosDe("efectivo");
      sesion.ventas_qr = ventasDe("qr");
      sesion.cobros_efectivo = cobrosDe("efectivo");
      sesion.cobros_qr = cobrosDe("qr");
      sesion.fecha_cierre = new Date().toISOString();
      const movs = mockMovCaja.filter((m) => m.caja_sesion_id === cajaSesionId);
      sesion.ventas_efectivo = ventasDe("efectivo");
      sesion.otros_ingresos = movs.filter((m) => m.tipo === "ingreso").reduce((a, m) => a + m.monto, 0);
      sesion.otros_egresos = movs.filter((m) => m.tipo === "egreso").reduce((a, m) => a + m.monto, 0);
      sesion.monto_esperado = sesion.monto_apertura + totalEfectivo + sesion.otros_ingresos - sesion.otros_egresos;
      sesion.monto_contado = montoContado;
      logMock(
        "cerrar_caja",
        "caja",
        `Cerró caja #${sesion.id} · esperado Bs ${sesion.monto_esperado.toFixed(2)} · contado Bs ${montoContado.toFixed(2)}`
      );
      return sesion;
    }
    return invoke("cerrar_caja", { cajaSesionId, montoContado });
  },

  // --- Otros ingresos y egresos de caja ---
  async registrarMovimientoCaja(movimiento) {
    if (!isTauri) {
      await wait();
      const u = mockUsuarioActual;
      const hoy = hoyIso();
      if (!(movimiento.monto > 0)) throw "El monto debe ser mayor a cero";
      if (!movimiento.concepto.trim()) throw "Escribe el concepto";
      if (movimiento.fecha > hoy) throw "La fecha no puede ser futura";
      if (u.rol !== "admin" && movimiento.fecha !== hoy) throw "Solo un administrador puede registrar movimientos de otra fecha";
      const caja = movimiento.fecha === hoy ? mockCajaSesiones.find((c) => c.usuario_id === u.id && !c.fecha_cierre) : null;
      if (u.rol !== "admin" && !caja) throw "Abre tu caja antes de registrar movimientos";
      const m = { id: mockMovCaja.length + 1, ...movimiento, concepto: movimiento.concepto.trim(), usuario_id: u.id, usuario_nombre: u.nombre, caja_sesion_id: caja?.id ?? null, registrado: new Date().toISOString() };
      mockMovCaja.push(m);
      logMock(movimiento.tipo === "ingreso" ? "ingreso_caja" : "egreso_caja", "caja", `${movimiento.tipo === "ingreso" ? "Ingreso" : "Egreso"} de Bs ${movimiento.monto.toFixed(2)} · ${m.concepto} · fecha ${movimiento.fecha}`);
      return m;
    }
    return invoke("registrar_movimiento_caja", { movimiento });
  },

  async listarMovimientosCaja(filtros = {}) {
    if (!isTauri) {
      await wait();
      const u = mockUsuarioActual;
      return mockMovCaja
        .filter((m) => (u?.rol === "admin" || m.usuario_id === u?.id)
          && (!filtros.desde || m.fecha >= filtros.desde) && (!filtros.hasta || m.fecha <= filtros.hasta)
          && (!filtros.tipo || m.tipo === filtros.tipo) && (!filtros.usuarioId || m.usuario_id === filtros.usuarioId))
        .sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : b.id - a.id));
    }
    return invoke("listar_movimientos_caja", { desde: filtros.desde || null, hasta: filtros.hasta || null, tipo: filtros.tipo || null, usuarioId: filtros.usuarioId || null });
  },

  async eliminarMovimientoCaja(id) {
    if (!isTauri) {
      await wait();
      const m = mockMovCaja.find((x) => x.id === id);
      if (m?.caja_sesion_id && mockCajaSesiones.find((c) => c.id === m.caja_sesion_id)?.fecha_cierre) throw "Este movimiento ya forma parte de una caja cerrada y no se puede eliminar";
      mockMovCaja = mockMovCaja.filter((x) => x.id !== id);
      if (m) logMock("eliminar_movimiento_caja", "caja", `Eliminó ${m.tipo} de Bs ${m.monto.toFixed(2)} · ${m.concepto} · fecha ${m.fecha}`);
      return;
    }
    return invoke("eliminar_movimiento_caja", { id });
  },

  async listarProductos() {
    if (!isTauri) {
      await wait();
      return [...mockProductos];
    }
    return invoke("listar_productos");
  },

  async buscarProductos(texto) {
    if (!isTauri) {
      await wait(60);
      return filtrarProductos(texto);
    }
    return invoke("buscar_productos", { texto });
  },

  async listarCategorias() {
    if (!isTauri) {
      await wait();
      return [...mockCategorias];
    }
    return invoke("listar_categorias");
  },

  async crearCategoria(nombre) {
    if (!isTauri) {
      await wait();
      const cat = { id: nextId.categoria++, nombre };
      mockCategorias.push(cat);
      return cat;
    }
    return invoke("crear_categoria", { nombre });
  },

  async eliminarCategoria(id) {
    if (!isTauri) {
      await wait();
      const enUso = mockProductos.some((p) => p.categoria_id === id);
      if (enUso) throw "No se puede eliminar: hay productos usando esta categoría";
      mockCategorias = mockCategorias.filter((c) => c.id !== id);
      return;
    }
    return invoke("eliminar_categoria", { id });
  },

  async crearProducto(producto) {
    if (!isTauri) {
      await wait();
      const cat = mockCategorias.find((c) => c.id === producto.categoria_id);
      const nuevo = { id: nextId.producto++, categoria_nombre: cat ? cat.nombre : null, ...producto };
      mockProductos.push(nuevo);
      logMock("crear_producto", "producto", `Creó el producto ${nuevo.nombre} · stock ${nuevo.stock} · venta Bs ${Number(nuevo.precio_venta).toFixed(2)}`);
      return nuevo;
    }
    return invoke("crear_producto", { producto });
  },

  async actualizarProducto(id, producto) {
    if (!isTauri) {
      await wait();
      const idx = mockProductos.findIndex((p) => p.id === id);
      const cat = mockCategorias.find((c) => c.id === producto.categoria_id);
      if (idx >= 0) {
        const antes = mockProductos[idx];
        const cambios = [];
        if (antes.stock !== producto.stock) cambios.push(`stock: ${antes.stock} → ${producto.stock}`);
        if (antes.precio_venta !== producto.precio_venta)
          cambios.push(`precio venta: ${Number(antes.precio_venta).toFixed(2)} → ${Number(producto.precio_venta).toFixed(2)}`);
        if (antes.precio_facturado !== producto.precio_facturado)
          cambios.push(`precio facturado: ${Number(antes.precio_facturado).toFixed(2)} → ${Number(producto.precio_facturado).toFixed(2)}`);
        if ((antes.estante || "") !== (producto.estante || "")) cambios.push(`estante: ${antes.estante || "—"} → ${producto.estante || "—"}`);
        logMock("editar_producto", "producto", `${antes.nombre} — ${cambios.length ? cambios.join("; ") : "sin cambios"}`);
        mockProductos[idx] = { id, categoria_nombre: cat ? cat.nombre : null, ...producto };
      }
      return;
    }
    return invoke("actualizar_producto", { id, producto });
  },

  async eliminarProducto(id) {
    if (!isTauri) {
      await wait();
      const baja = mockProductos.find((p) => p.id === id);
      mockProductos = mockProductos.filter((p) => p.id !== id);
      if (baja) logMock("baja_producto", "producto", `Dio de baja ${baja.nombre} (stock al momento: ${baja.stock})`);
      return;
    }
    return invoke("eliminar_producto", { id });
  },

  async listarProveedores() {
    if (!isTauri) {
      await wait();
      return [...mockProveedores];
    }
    return invoke("listar_proveedores");
  },

  async crearProveedor(proveedor) {
    if (!isTauri) {
      await wait();
      const nuevo = { id: nextId.proveedor++, saldo: 0, ...proveedor };
      mockProveedores.push(nuevo);
      return nuevo;
    }
    return invoke("crear_proveedor", { proveedor });
  },

  async registrarCompra(compra) {
    if (!isTauri) {
      await wait();
      const montoTotal = compra.items.reduce((acc, i) => acc + i.costo_unitario * i.cantidad, 0);
      compra.items.forEach((i) => {
        const prod = mockProductos.find((p) => p.id === i.producto_id);
        if (prod) prod.stock += i.cantidad;
      });
      if (compra.es_credito) {
        const prov = mockProveedores.find((p) => p.id === compra.proveedor_id);
        if (prov) prov.saldo += montoTotal;
        mockMovimientosProveedor.push({
          id: mockMovimientosProveedor.length + 1,
          proveedor_id: compra.proveedor_id,
          tipo: "compra_credito",
          monto: montoTotal,
          fecha: new Date().toISOString(),
          descripcion: "Compra registrada",
        });
      }
      const provC = mockProveedores.find((p) => p.id === compra.proveedor_id);
      logMock("compra", "compra", `Compra a ${provC ? provC.nombre : "proveedor"} · ${compra.items.length} producto(s) · Bs ${montoTotal.toFixed(2)} · ${compra.es_credito ? "a crédito" : "al contado"}`);
      return mockMovimientosProveedor.length;
    }
    return invoke("registrar_compra", { compra });
  },

  async registrarPagoProveedor(proveedorId, monto) {
    if (!isTauri) {
      await wait();
      const prov = mockProveedores.find((p) => p.id === proveedorId);
      if (prov) prov.saldo -= monto;
      logMock("pago_proveedor", "proveedor", `Pagó Bs ${monto.toFixed(2)} a ${prov ? prov.nombre : "proveedor"}`);
      mockMovimientosProveedor.push({
        id: mockMovimientosProveedor.length + 1,
        proveedor_id: proveedorId,
        tipo: "pago",
        monto,
        fecha: new Date().toISOString(),
        descripcion: "Pago a proveedor",
      });
      return;
    }
    return invoke("registrar_pago_proveedor", { proveedorId, monto });
  },

  async listarMovimientosProveedor(proveedorId) {
    if (!isTauri) {
      await wait();
      return mockMovimientosProveedor.filter((m) => m.proveedor_id === proveedorId);
    }
    return invoke("listar_movimientos_proveedor", { proveedorId });
  },

  async listarClientes() {
    if (!isTauri) {
      await wait();
      return [...mockClientes];
    }
    return invoke("listar_clientes");
  },

  async crearCliente(cliente) {
    if (!isTauri) {
      await wait();
      const nuevo = { id: nextId.cliente++, ...cliente };
      mockClientes.push(nuevo);
      return nuevo;
    }
    return invoke("crear_cliente", { cliente });
  },

  async registrarVenta(venta) {
    if (!isTauri) {
      await wait();
      const caja = mockCajaSesiones.find((c) => c.id === venta.caja_sesion_id);
      if (!caja || caja.fecha_cierre) throw "Esta caja ya está cerrada. Abre una nueva caja para vender.";
      // Igual que el backend real: el precio sale del producto y el stock se valida aquí
      const items = venta.items.map((i) => {
        const prod = mockProductos.find((p) => p.id === i.producto_id);
        if (!prod) throw "Hay un producto del ticket que ya no existe";
        if (prod.stock < i.cantidad) throw `Stock insuficiente de ${prod.nombre}: quedan ${prod.stock} y pediste ${i.cantidad}`;
        return {
          producto_id: prod.id,
          cantidad: i.cantidad,
          precio_unitario: venta.es_facturado ? prod.precio_facturado : prod.precio_venta,
        };
      });
      const montoTotal = items.reduce((acc, i) => acc + i.precio_unitario * i.cantidad, 0);
      const montoAbonado = venta.es_credito ? venta.monto_pagado_inicial : montoTotal;
      const usuario = mockUsuarioActual;
      const cliente = mockClientes.find((c) => c.id === venta.cliente_id);
      const nueva = {
        id: nextId.venta++,
        fecha: new Date().toISOString(),
        caja_sesion_id: venta.caja_sesion_id,
        usuario_id: usuario ? usuario.id : null,
        usuario_nombre: usuario ? usuario.nombre : null,
        cliente_id: venta.cliente_id || null,
        cliente_nombre: cliente ? cliente.nombre : null,
        es_credito: venta.es_credito,
        es_facturado: venta.es_facturado,
        metodo_pago: venta.metodo_pago,
        monto_total: montoTotal,
        monto_abonado: montoAbonado,
        nombre_comprador: venta.nombre_comprador || null,
        cantidad_items: items.reduce((acc, i) => acc + i.cantidad, 0),
        items,
      };
      items.forEach((i) => {
        mockProductos.find((p) => p.id === i.producto_id).stock -= i.cantidad;
      });
      if (venta.es_credito && montoAbonado > 0) {
        mockPagosVenta.push({ id: mockPagosVenta.length + 1, venta_id: nueva.id, fecha: nueva.fecha, monto: montoAbonado });
      }
      mockVentas.push(nueva);
      logMock(
        "venta",
        "venta",
        `Venta #${nueva.id} · Bs ${montoTotal.toFixed(2)} · ${venta.es_facturado ? "con factura" : "sin factura"} · ${venta.metodo_pago} · ${nueva.cantidad_items} unidad(es)`
      );
      return nueva;
    }
    return invoke("registrar_venta", { venta });
  },

  // filtros: { cajaSesionId, usuarioId, desde, hasta }. Un cajero solo ve sus propias ventas.
  async listarVentas(filtros = {}) {
    const { cajaSesionId = null, usuarioId = null, desde = null, hasta = null } = filtros;
    if (!isTauri) {
      await wait();
      const soloMias = mockUsuarioActual && mockUsuarioActual.rol !== "admin";
      return mockVentas
        .filter((v) => !cajaSesionId || v.caja_sesion_id === cajaSesionId)
        .filter((v) => (soloMias ? v.usuario_id === mockUsuarioActual.id : !usuarioId || v.usuario_id === usuarioId))
        .filter((v) => !desde || v.fecha.slice(0, 10) >= desde)
        .filter((v) => !hasta || v.fecha.slice(0, 10) <= hasta)
        .map((v) => ({ ...v }))
        .reverse();
    }
    return invoke("listar_ventas", { cajaSesionId, usuarioId, desde, hasta });
  },

  async listarItemsVenta(ventaId) {
    if (!isTauri) {
      await wait(60);
      const v = mockVentas.find((x) => x.id === ventaId);
      return (v ? v.items : []).map((i, idx) => {
        const p = mockProductos.find((x) => x.id === i.producto_id) || {};
        return { id: idx + 1, producto_id: i.producto_id, nombre: p.nombre, codigo: p.codigo, oem: p.oem, estante: p.estante, cantidad: i.cantidad, precio_unitario: i.precio_unitario };
      });
    }
    return invoke("listar_items_venta", { ventaId });
  },

  // filtros: { usuario_id, accion, desde, hasta, texto, limite }
  async listarAuditoria(filtros = {}) {
    if (!isTauri) {
      await wait();
      const t = (filtros.texto || "").toLowerCase();
      return mockAuditoria
        .filter((e) => !filtros.usuario_id || e.usuario_id === filtros.usuario_id)
        .filter((e) => !filtros.accion || e.accion === filtros.accion)
        .filter((e) => !filtros.desde || e.fecha.slice(0, 10) >= filtros.desde)
        .filter((e) => !filtros.hasta || e.fecha.slice(0, 10) <= filtros.hasta)
        .filter((e) => !t || `${e.detalle} ${e.usuario_nombre} ${e.entidad}`.toLowerCase().includes(t))
        .map((e) => ({ ...e }))
        .reverse()
        .slice(0, filtros.limite || 500);
    }
    return invoke("listar_auditoria", { filtros });
  },

  // --- Red local ---
  async obtenerConfig() {
    if (!isTauri) {
      return { modo: "independiente", puerto: 7878, servidor_url: "", ips: ["192.168.1.20"], error_servidor: null, sesiones_activas: 0, version: "vista previa" };
    }
    return invoke("obtener_config");
  },
  async guardarConfig({ modo, puerto, servidorUrl }) {
    if (!isTauri) throw "La configuración de red solo se puede cambiar en la app instalada.";
    return invoke("guardar_config", { modo, puerto, servidorUrl });
  },
  async probarConexion(url) {
    if (!isTauri) throw "La prueba de conexión solo funciona en la app instalada.";
    return invoke("probar_conexion", { url });
  },
  async reiniciarApp() {
    if (isTauri) return tauriInvoke("reiniciar_app");
  },

  async listarDeudasClientes(busqueda = "") {
    if (!isTauri) {
      await wait();
      const t = busqueda.toLowerCase();
      return mockVentas
        .filter((v) => v.es_credito && v.monto_abonado < v.monto_total)
        .filter((v) => (v.cliente_nombre || v.nombre_comprador || "").toLowerCase().includes(t))
        .map((v) => ({
          venta_id: v.id,
          cliente_id: v.cliente_id,
          cliente_nombre: v.cliente_nombre || v.nombre_comprador || "Sin nombre",
          fecha: v.fecha,
          monto_total: v.monto_total,
          monto_abonado: v.monto_abonado,
          saldo: v.monto_total - v.monto_abonado,
        }));
    }
    return invoke("listar_deudas_clientes", { busqueda });
  },

  async registrarPagoVenta(ventaId, monto, metodoPago = "efectivo") {
    if (!isTauri) {
      await wait();
      const caja = mockCajaSesiones.find((c) => c.usuario_id === mockUsuarioActual?.id && !c.fecha_cierre);
      if (!caja) throw "Abre tu caja antes de registrar un abono";
      const venta = mockVentas.find((v) => v.id === ventaId);
      if (venta) venta.monto_abonado += monto;
      logMock("abono_cliente", "venta", `Abono de Bs ${monto.toFixed(2)} a la venta #${ventaId}`);
      mockPagosVenta.push({ id: mockPagosVenta.length + 1, venta_id: ventaId, fecha: new Date().toISOString(), monto, caja_sesion_id: caja.id, metodo_pago: metodoPago });
      return;
    }
    return invoke("registrar_pago_venta", { ventaId, monto, metodoPago });
  },

  async listarPagosVenta(ventaId) {
    if (!isTauri) {
      await wait();
      return mockPagosVenta.filter((p) => p.venta_id === ventaId);
    }
    return invoke("listar_pagos_venta", { ventaId });
  },

  async listarUsuarios() {
    if (!isTauri) {
      await wait();
      return [...mockUsuarios];
    }
    return invoke("listar_usuarios");
  },

  async crearUsuario(usuario) {
    if (!isTauri) {
      await wait();
      const nuevo = { id: nextId.usuario++, activo: true, nombre: usuario.nombre, usuario: usuario.usuario, rol: usuario.rol };
      mockUsuarios.push(nuevo);
      logMock("crear_usuario", "usuario", `Creó al usuario ${nuevo.nombre} (${nuevo.usuario}) con rol ${nuevo.rol}`);
      return nuevo;
    }
    return invoke("crear_usuario", { usuario });
  },

  async editarUsuario(id, datos) {
    if (!isTauri) {
      await wait();
      const u = mockUsuarios.find((x) => x.id === id);
      if (!u) throw "Usuario no encontrado";
      if (mockUsuarios.some((x) => x.id !== id && x.usuario === datos.usuario.trim())) throw "Ya existe otro usuario con ese nombre de usuario";
      if (datos.password && datos.password.trim().length < 4) throw "La contraseña debe tener al menos 4 caracteres";
      Object.assign(u, { nombre: datos.nombre.trim(), usuario: datos.usuario.trim(), rol: datos.rol });
      logMock("editar_usuario", "usuario", `Editó al usuario ${u.nombre} (${u.usuario})${datos.password ? ", contraseña restablecida" : ""}`);
      return;
    }
    return invoke("editar_usuario", { id, datos });
  },

  async cambiarMiPassword(actual, nueva) {
    if (!isTauri) {
      await wait();
      if (actual !== "admin123" && actual !== "1234") throw "La contraseña actual no es correcta";
      if (nueva.trim().length < 4) throw "La nueva contraseña debe tener al menos 4 caracteres";
      logMock("cambiar_password", "usuario", "Cambió su propia contraseña");
      return;
    }
    return invoke("cambiar_mi_password", { actual, nueva });
  },

  async cambiarEstadoUsuario(id, activo) {
    if (!isTauri) {
      await wait();
      const u = mockUsuarios.find((x) => x.id === id);
      if (u) u.activo = activo;
      if (u) logMock("cambiar_estado_usuario", "usuario", `${activo ? "Activó" : "Desactivó"} al usuario ${u.nombre} (${u.usuario})`);
      return;
    }
    return invoke("cambiar_estado_usuario", { id, activo });
  },

  async listarRentabilidadProductos() {
    if (!isTauri) {
      await wait();
      return mockProductos.map((p) => {
        const vendidas = mockVentas.flatMap((v) => v.items || []).filter((i) => i.producto_id === p.id);
        const cantidadVendida = vendidas.reduce((acc, i) => acc + i.cantidad, 0);
        const totalVendido = vendidas.reduce((acc, i) => acc + i.cantidad * i.precio_unitario, 0);
        return {
          producto_id: p.id,
          nombre: p.nombre,
          categoria: p.categoria_nombre,
          estante: p.estante,
          stock: p.stock,
          cantidad_vendida: cantidadVendida,
          total_vendido: totalVendido,
          costo_promedio: null,
          ganancia_neta: null,
          ultima_compra: null,
        };
      });
    }
    return invoke("listar_rentabilidad_productos");
  },

  async resumenGeneral() {
    if (!isTauri) {
      await wait();
      const totalCobrado = mockPagosVenta.reduce((acc, p) => acc + p.monto, 0);
      const totalPorCobrar = mockVentas
        .filter((v) => v.es_credito)
        .reduce((acc, v) => acc + (v.monto_total - v.monto_abonado), 0);
      const totalPorPagar = mockMovimientosProveedor.reduce(
        (acc, m) => acc + (m.tipo === "compra_credito" ? m.monto : -m.monto),
        0
      );
      return {
        total_cobrado_creditos: totalCobrado,
        total_por_cobrar: totalPorCobrar,
        total_por_pagar: totalPorPagar,
        balance: totalPorCobrar - totalPorPagar,
      };
    }
    return invoke("resumen_general");
  },
};

export { isTauri };
