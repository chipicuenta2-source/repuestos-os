import { useEffect, useState } from "react";
import { api } from "../../api.js";
import NotaVenta from "../modals/NotaVenta.jsx";

export default function POS({ usuario, cajaSesion }) {
  const [productos, setProductos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [categoriaActiva, setCategoriaActiva] = useState(null);
  const [busqueda, setBusqueda] = useState("");
  const [carrito, setCarrito] = useState([]); // { producto, cantidad }
  const [esFacturado, setEsFacturado] = useState(false);
  const [metodoPago, setMetodoPago] = useState("efectivo");
  const [esCredito, setEsCredito] = useState(false);
  const [clientes, setClientes] = useState([]);
  const [clienteId, setClienteId] = useState("");
  const [nombreComprador, setNombreComprador] = useState("");
  const [montoPagadoInicial, setMontoPagadoInicial] = useState("");
  const [mostrarNuevoCliente, setMostrarNuevoCliente] = useState(false);
  const [nuevoClienteNombre, setNuevoClienteNombre] = useState("");
  const [ultimaVenta, setUltimaVenta] = useState(null);
  const [verNota, setVerNota] = useState(false);
  const [cobrando, setCobrando] = useState(false);
  const [errorVenta, setErrorVenta] = useState("");

  useEffect(() => {
    cargarProductos();
    api.listarCategorias().then(setCategorias);
    api.listarClientes().then(setClientes);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      if (busqueda.trim()) {
        api.buscarProductos(busqueda.trim()).then(setProductos);
      } else {
        cargarProductos();
      }
    }, 200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busqueda]);

  function cargarProductos() {
    api.listarProductos().then(setProductos);
  }

  // Con varias PCs vendiendo, el stock cambia solo: se refresca el catálogo cada 15 s
  useEffect(() => {
    if (busqueda.trim()) return;
    const t = setInterval(cargarProductos, 15000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busqueda]);

  const productosFiltrados = productos.filter(
    (p) => !categoriaActiva || p.categoria_id === categoriaActiva
  );

  function precioDe(producto) {
    return esFacturado ? producto.precio_facturado : producto.precio_venta;
  }

  function agregarAlCarrito(producto) {
    if (producto.stock <= 0) return;
    setCarrito((prev) => {
      const existente = prev.find((i) => i.producto.id === producto.id);
      if (existente) {
        if (existente.cantidad >= producto.stock) return prev;
        return prev.map((i) =>
          i.producto.id === producto.id ? { ...i, cantidad: i.cantidad + 1 } : i
        );
      }
      return [...prev, { producto, cantidad: 1 }];
    });
  }

  function cambiarCantidad(productoId, delta) {
    setCarrito((prev) =>
      prev
        .map((i) => {
          if (i.producto.id !== productoId) return i;
          const nueva = Math.max(1, Math.min(i.producto.stock, i.cantidad + delta));
          return { ...i, cantidad: nueva };
        })
    );
  }

  function fijarCantidad(productoId, valor) {
    const n = parseInt(valor, 10);
    setCarrito((prev) =>
      prev.map((i) => {
        if (i.producto.id !== productoId) return i;
        if (isNaN(n) || n < 1) return { ...i, cantidad: 1 };
        return { ...i, cantidad: Math.min(n, i.producto.stock) };
      })
    );
  }

  function quitarDelCarrito(productoId) {
    setCarrito((prev) => prev.filter((i) => i.producto.id !== productoId));
  }

  const subtotal = carrito.reduce((acc, i) => acc + precioDe(i.producto) * i.cantidad, 0);
  const total = subtotal;

  async function crearClienteInline() {
    if (!nuevoClienteNombre.trim()) return;
    const c = await api.crearCliente({ nombre: nuevoClienteNombre.trim(), telefono: "", carnet: "" });
    setClientes((prev) => [...prev, c]);
    setClienteId(String(c.id));
    setMostrarNuevoCliente(false);
    setNuevoClienteNombre("");
  }

  async function cobrar() {
    if (carrito.length === 0) return;
    setErrorVenta("");
    setCobrando(true);
    try {
      const venta = await api.registrarVenta({
        caja_sesion_id: cajaSesion.id,
        cliente_id: esCredito && clienteId ? parseInt(clienteId, 10) : null,
        es_credito: esCredito,
        es_facturado: esFacturado,
        metodo_pago: metodoPago,
        monto_pagado_inicial: esCredito ? parseFloat(montoPagadoInicial || "0") : total,
        nombre_comprador: !esCredito ? nombreComprador || null : null,
        items: carrito.map((i) => ({ producto_id: i.producto.id, cantidad: i.cantidad })),
      });
      // La nota se arma con lo que el servidor realmente guardó (precios y totales oficiales)
      const items = await api.listarItemsVenta(venta.id);
      setUltimaVenta({ ...venta, items });
      setCarrito([]);
      setNombreComprador("");
      setMontoPagadoInicial("");
      setClienteId("");
      setEsCredito(false);
      cargarProductos();
    } catch (err) {
      setErrorVenta(typeof err === "string" ? err : err?.message || "No se pudo registrar la venta");
      cargarProductos(); // el stock pudo haber cambiado desde otra PC
    } finally {
      setCobrando(false);
    }
  }

  if (ultimaVenta) {
    return (
      <div className="pos-layout">
        <div className="catalog" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div className="success-panel card" style={{ maxWidth: 420 }}>
            <div className="check">✓</div>
            <h2 style={{ marginBottom: 10 }}>Venta realizada</h2>
            <p style={{ color: "var(--text-muted)", marginBottom: 6 }}>
              Total: <span className="mono" style={{ fontWeight: 700, color: "var(--text-main)" }}>Bs {ultimaVenta.monto_total.toFixed(2)}</span>
            </p>
            <p style={{ color: "var(--text-muted)", marginBottom: 18 }}>
              {ultimaVenta.es_facturado ? "Con factura" : "Sin factura"} · {ultimaVenta.metodo_pago}
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <button className="btn btn-secondary" onClick={() => setVerNota(true)}>Ver nota de venta</button>
              <button className="btn btn-primary" onClick={() => setUltimaVenta(null)}>Nueva venta</button>
            </div>
          </div>
        </div>
        {verNota && <NotaVenta venta={ultimaVenta} onClose={() => setVerNota(false)} />}
      </div>
    );
  }

  return (
    <div className="pos-layout">
      <div className="catalog">
        <div className="search-box">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            placeholder="Buscar por nombre, código, OEM o detalle del vehículo..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>
        <div className="search-hint">La búsqueda cruza nombre, código interno, OEM y descripción de compatibilidad a la vez</div>

        <div className="chips-row">
          <div className={`chip ${!categoriaActiva ? "active" : ""}`} onClick={() => setCategoriaActiva(null)}>Todos</div>
          {categorias.map((c) => (
            <div
              key={c.id}
              className={`chip ${categoriaActiva === c.id ? "active" : ""}`}
              onClick={() => setCategoriaActiva(c.id)}
            >
              {c.nombre}
            </div>
          ))}
        </div>

        <div className="grid">
          {productosFiltrados.map((p) => (
            <div
              key={p.id}
              className={`product-card ${p.stock <= 0 ? "sin-stock" : ""}`}
              onClick={() => agregarAlCarrito(p)}
            >
              <div className={`stock-badge ${p.stock <= p.stock_minimo ? "low" : ""}`}>{p.stock} u.</div>
              <div className="product-name">{p.nombre}</div>
              <div className="product-detail">{p.detalle} {p.marca ? `· ${p.marca}` : ""} {p.procedencia ? `· ${p.procedencia}` : ""}</div>
              <div className="tag-row">
                {p.estante && <div className="tag estante">📦 {p.estante}</div>}
                {p.etiqueta && <div className="tag etiqueta">🏷️ {p.etiqueta}</div>}
              </div>
              <div className="code-row">
                <div className="code-col">{p.oem ? "OEM" : "COD"}<br /><span className="mono">{p.oem || p.codigo}</span></div>
                <div className="price-tag mono">Bs {precioDe(p).toFixed(2)}</div>
              </div>
            </div>
          ))}
          {productosFiltrados.length === 0 && (
            <p style={{ color: "var(--text-muted)", gridColumn: "1 / -1" }}>No se encontraron productos.</p>
          )}
        </div>
      </div>

      <div className="ticket-panel">
        <div className="ticket-header">
          <h2>Ticket de Venta</h2>
          <div className="factura-toggle">
            <button className={!esFacturado ? "active" : ""} onClick={() => setEsFacturado(false)}>Sin factura</button>
            <button className={esFacturado ? "active on" : ""} onClick={() => setEsFacturado(true)}>Con factura</button>
          </div>
        </div>

        <div className="ticket-items">
          {carrito.length === 0 && <div className="ticket-empty">Toca un producto del catálogo para agregarlo</div>}
          {carrito.map(({ producto, cantidad }) => (
            <div className="ticket-item" key={producto.id}>
              <div className="ti-top">
                <div>
                  <div className="ti-name">{producto.nombre}</div>
                  <div className="ti-meta mono">{producto.oem || producto.codigo} · {producto.estante}</div>
                </div>
                <button className="ti-remove" onClick={() => quitarDelCarrito(producto.id)} title="Quitar del ticket">🗑</button>
              </div>
              <div className="ti-breakdown">
                <div className="ti-calc">
                  <span className="mono">Bs {precioDe(producto).toFixed(2)}</span> ×
                  <div className="qty-control">
                    <button onClick={() => cambiarCantidad(producto.id, -1)}>–</button>
                    <input value={cantidad} onChange={(e) => fijarCantidad(producto.id, e.target.value)} />
                    <button onClick={() => cambiarCantidad(producto.id, 1)}>+</button>
                  </div>
                </div>
                <div className="ti-subtotal mono">Bs {(precioDe(producto) * cantidad).toFixed(2)}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="ticket-summary">
          <div className="sum-row"><span>Subtotal</span><span className="mono">Bs {subtotal.toFixed(2)}</span></div>
          <div className="sum-row total"><span>Total</span><span className="mono">Bs {total.toFixed(2)}</span></div>
        </div>

        <div className="pay-section">
          {errorVenta && <div className="error-msg">{errorVenta}</div>}
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, fontWeight: 600, marginBottom: 10 }}>
            <input type="checkbox" checked={esCredito} onChange={(e) => setEsCredito(e.target.checked)} />
            Venta a crédito
          </label>

          {esCredito ? (
            <div className="credit-box">
              <div className="field">
                <label className="label">Cliente</label>
                {!mostrarNuevoCliente ? (
                  <select className="input" value={clienteId} onChange={(e) => setClienteId(e.target.value)}>
                    <option value="">Seleccionar cliente...</option>
                    {clientes.map((c) => (
                      <option key={c.id} value={c.id}>{c.nombre}</option>
                    ))}
                  </select>
                ) : (
                  <div style={{ display: "flex", gap: 6 }}>
                    <input className="input" value={nuevoClienteNombre} onChange={(e) => setNuevoClienteNombre(e.target.value)} placeholder="Nombre del cliente" />
                    <button type="button" className="btn btn-primary btn-sm" onClick={crearClienteInline}>Crear</button>
                  </div>
                )}
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={{ marginTop: 6 }}
                  onClick={() => setMostrarNuevoCliente((v) => !v)}
                >
                  {mostrarNuevoCliente ? "Cancelar" : "+ Nuevo cliente"}
                </button>
              </div>
              <div className="field">
                <label className="label">Abono inicial (Bs)</label>
                <input className="input mono" type="number" min="0" step="0.01" value={montoPagadoInicial} onChange={(e) => setMontoPagadoInicial(e.target.value)} />
              </div>
            </div>
          ) : (
            <div className="field">
              <label className="label">Nombre del comprador (opcional)</label>
              <input className="input" value={nombreComprador} onChange={(e) => setNombreComprador(e.target.value)} />
            </div>
          )}

          <div className="pay-methods">
            <button className={metodoPago === "efectivo" ? "sel" : ""} onClick={() => setMetodoPago("efectivo")}>💵 Efectivo</button>
            <button className={metodoPago === "qr" ? "sel" : ""} onClick={() => setMetodoPago("qr")}>📱 QR</button>
          </div>

          <button
            className="btn-cobrar"
            disabled={carrito.length === 0 || cobrando || (esCredito && !clienteId)}
            onClick={cobrar}
          >
            {cobrando ? "Procesando..." : `Cobrar Bs ${total.toFixed(2)}`}
          </button>
        </div>
      </div>
    </div>
  );
}
