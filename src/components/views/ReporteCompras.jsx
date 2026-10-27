import { Fragment, useEffect, useMemo, useState } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { api } from "../../api.js";
import VistaPreviaPDF from "../modals/VistaPreviaPDF.jsx";
import { encabezadoPDF } from "../../marca.js";
import { fechaHora, fechaIso, hace } from "../etiquetasAuditoria.js";

const bs = (n) => `Bs ${(n || 0).toFixed(2)}`;

// Reporte de proveedores: qué se compró, qué material ingresó al almacén y qué se pagó.
export default function ReporteCompras() {
  const [proveedores, setProveedores] = useState([]);
  const [proveedorId, setProveedorId] = useState("");
  const [desde, setDesde] = useState(hace(30));
  const [hasta, setHasta] = useState(fechaIso());
  const [vista, setVista] = useState("compras");
  const [compras, setCompras] = useState([]);
  const [items, setItems] = useState([]);
  const [pagos, setPagos] = useState([]);
  const [abierta, setAbierta] = useState(null);
  const [pdf, setPdf] = useState(null);
  const [cargando, setCargando] = useState(false);

  useEffect(() => { api.listarProveedores().then(setProveedores); }, []);

  useEffect(() => {
    let vivo = true;
    setCargando(true);
    const f = { proveedorId: proveedorId ? parseInt(proveedorId, 10) : null, desde: desde || null, hasta: hasta || null };
    Promise.all([api.listarCompras(f), api.listarItemsCompras(f), api.listarPagosProveedores(f)])
      .then(([c, i, p]) => { if (vivo) { setCompras(c); setItems(i); setPagos(p); } })
      .finally(() => vivo && setCargando(false));
    return () => { vivo = false; };
  }, [proveedorId, desde, hasta]);

  function rapido(dias) { setDesde(hace(dias)); setHasta(fechaIso()); }

  const totalComprado = useMemo(() => compras.reduce((a, c) => a + c.monto_total, 0), [compras]);
  const totalCredito = useMemo(() => compras.filter((c) => c.es_credito).reduce((a, c) => a + c.monto_total, 0), [compras]);
  const totalPagado = useMemo(() => pagos.reduce((a, p) => a + p.monto, 0), [pagos]);
  const porPagar = useMemo(() => proveedores.reduce((a, p) => a + (p.saldo || 0), 0), [proveedores]);

  const porProveedor = useMemo(() => {
    const m = new Map();
    compras.forEach((c) => {
      const r = m.get(c.proveedor_id) || { nombre: c.proveedor_nombre, compras: 0, total: 0, unidades: 0 };
      r.compras += 1; r.total += c.monto_total; r.unidades += c.unidades || 0;
      m.set(c.proveedor_id, r);
    });
    return [...m.values()].sort((a, b) => b.total - a.total);
  }, [compras]);

  const itemsDe = (id) => items.filter((i) => i.compra_id === id);

  function exportarPDF() {
    const doc = new jsPDF({ orientation: "landscape" });
    const titulo = vista === "compras" ? "Compras a proveedores" : vista === "material" ? "Material ingresado" : "Pagos a proveedores";
    const y0 = encabezadoPDF(doc, titulo);
    const prov = proveedorId ? (proveedores.find((p) => String(p.id) === proveedorId) || {}).nombre : "todos los proveedores";
    doc.setFontSize(9);
    doc.text(`Del ${desde || "inicio"} al ${hasta || "hoy"} · ${prov} · generado ${new Date().toLocaleString("es-BO")}`, 14, y0);
    if (vista === "compras") {
      autoTable(doc, { startY: y0 + 4, styles: { fontSize: 8 },
        head: [["#", "Fecha", "Proveedor", "Productos", "Unidades", "Tipo", "Registró", "Total"]],
        body: compras.map((c) => [c.id, fechaHora(c.fecha), c.proveedor_nombre, c.productos, c.unidades, c.es_credito ? "Crédito" : "Contado", c.usuario_nombre || "—", bs(c.monto_total)]),
        foot: [["", "", "", "", "", "", "Total", bs(totalComprado)]] });
    } else if (vista === "material") {
      autoTable(doc, { startY: y0 + 4, styles: { fontSize: 8 },
        head: [["Fecha", "Compra", "Proveedor", "Producto", "Código", "Cantidad", "Costo unit.", "Subtotal"]],
        body: items.map((i) => [fechaHora(i.fecha), `#${i.compra_id}`, i.proveedor_nombre, i.nombre, i.oem || i.codigo || "", i.cantidad, bs(i.costo_unitario), bs(i.cantidad * i.costo_unitario)]) });
    } else {
      autoTable(doc, { startY: y0 + 4, styles: { fontSize: 9 },
        head: [["Fecha", "Proveedor", "Monto pagado"]],
        body: pagos.map((p) => [fechaHora(p.fecha), p.proveedor_nombre, bs(p.monto)]),
        foot: [["", "Total", bs(totalPagado)]] });
    }
    setPdf({ doc, nombre: `${vista}-proveedores-${fechaIso()}.pdf` });
  }

  return (
    <div>
      {pdf && <VistaPreviaPDF doc={pdf.doc} nombre={pdf.nombre} onClose={() => setPdf(null)} />}

      <div className="filters-grid">
        <div className="field">
          <label className="label">Proveedor</label>
          <select className="input" value={proveedorId} onChange={(e) => setProveedorId(e.target.value)}>
            <option value="">Todos</option>
            {proveedores.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
        </div>
        <div className="field"><label className="label">Desde</label><input className="input" type="date" value={desde} onChange={(e) => setDesde(e.target.value)} /></div>
        <div className="field"><label className="label">Hasta</label><input className="input" type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} /></div>
        <div className="chips-row" style={{ marginBottom: 0 }}>
          <div className="chip" onClick={() => rapido(0)}>Hoy</div>
          <div className="chip" onClick={() => rapido(7)}>7 días</div>
          <div className="chip" onClick={() => rapido(30)}>30 días</div>
          <div className="chip" onClick={() => { setDesde(""); setHasta(""); }}>Todo</div>
        </div>
        <button className="btn btn-primary" style={{ alignSelf: "flex-end" }} onClick={exportarPDF}>Ver PDF</button>
      </div>

      <div className="kpi-row">
        <div className="kpi-card"><div className="kpi-label">Compras</div><div className="kpi-value mono">{compras.length}</div></div>
        <div className="kpi-card"><div className="kpi-label">Total comprado</div><div className="kpi-value mono">{bs(totalComprado)}</div></div>
        <div className="kpi-card"><div className="kpi-label">A crédito</div><div className="kpi-value mono">{bs(totalCredito)}</div></div>
        <div className="kpi-card"><div className="kpi-label">Pagado a proveedores</div><div className="kpi-value mono">{bs(totalPagado)}</div></div>
        <div className="kpi-card"><div className="kpi-label">Por pagar (hoy)</div><div className="kpi-value mono">{bs(porPagar)}</div></div>
      </div>

      <div className="chips-row">
        <div className={`chip ${vista === "compras" ? "active" : ""}`} onClick={() => setVista("compras")}>Compras</div>
        <div className={`chip ${vista === "material" ? "active" : ""}`} onClick={() => setVista("material")}>Material ingresado</div>
        <div className={`chip ${vista === "pagos" ? "active" : ""}`} onClick={() => setVista("pagos")}>Pagos</div>
        <div className={`chip ${vista === "resumen" ? "active" : ""}`} onClick={() => setVista("resumen")}>Por proveedor</div>
      </div>

      <div className="card" style={{ padding: 0, overflowX: "auto" }}>
        {vista === "compras" && (
          <table className="table">
            <thead><tr><th>#</th><th>Fecha</th><th>Proveedor</th><th>Productos</th><th>Unid.</th><th>Tipo</th><th>Registró</th><th>Total</th><th></th></tr></thead>
            <tbody>
              {compras.map((c) => (
                <Fragment key={c.id}>
                  <tr>
                    <td className="mono">{c.id}</td>
                    <td className="mono" style={{ whiteSpace: "nowrap" }}>{fechaHora(c.fecha)}</td>
                    <td>{c.proveedor_nombre}</td>
                    <td className="mono">{c.productos}</td>
                    <td className="mono">{c.unidades}</td>
                    <td><span className={`badge ${c.es_credito ? "badge-red" : "badge-blue"}`}>{c.es_credito ? "Crédito" : "Contado"}</span></td>
                    <td>{c.usuario_nombre || "—"}</td>
                    <td className="mono" style={{ fontWeight: 700 }}>{bs(c.monto_total)}</td>
                    <td><button className="btn btn-secondary btn-sm" onClick={() => setAbierta(abierta === c.id ? null : c.id)}>{abierta === c.id ? "Ocultar" : "Ver detalle"}</button></td>
                  </tr>
                  {abierta === c.id && (
                    <tr>
                      <td colSpan={9} style={{ background: "var(--bg-main)" }}>
                        {itemsDe(c.id).map((i, k) => (
                          <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 13 }}>
                            <span>{i.nombre} <span className="mono" style={{ color: "var(--text-muted)", fontSize: 11 }}>{i.oem || i.codigo}</span></span>
                            <span className="mono">{i.cantidad} × {bs(i.costo_unitario)} = <b>{bs(i.cantidad * i.costo_unitario)}</b></span>
                          </div>
                        ))}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
              {compras.length === 0 && <tr><td colSpan={9} style={{ textAlign: "center", color: "var(--text-muted)" }}>{cargando ? "Cargando..." : "Sin compras en este período"}</td></tr>}
            </tbody>
          </table>
        )}

        {vista === "material" && (
          <table className="table">
            <thead><tr><th>Fecha</th><th>Compra</th><th>Proveedor</th><th>Producto</th><th>Código</th><th>Cantidad</th><th>Costo unit.</th><th>Subtotal</th></tr></thead>
            <tbody>
              {items.map((i, k) => (
                <tr key={k}>
                  <td className="mono" style={{ whiteSpace: "nowrap" }}>{fechaHora(i.fecha)}</td>
                  <td className="mono">#{i.compra_id}</td>
                  <td>{i.proveedor_nombre}</td>
                  <td>{i.nombre}</td>
                  <td className="mono">{i.oem || i.codigo || "—"}</td>
                  <td className="mono">{i.cantidad}</td>
                  <td className="mono">{bs(i.costo_unitario)}</td>
                  <td className="mono" style={{ fontWeight: 700 }}>{bs(i.cantidad * i.costo_unitario)}</td>
                </tr>
              ))}
              {items.length === 0 && <tr><td colSpan={8} style={{ textAlign: "center", color: "var(--text-muted)" }}>{cargando ? "Cargando..." : "No ingresó material en este período"}</td></tr>}
            </tbody>
          </table>
        )}

        {vista === "pagos" && (
          <table className="table">
            <thead><tr><th>Fecha</th><th>Proveedor</th><th>Monto pagado</th></tr></thead>
            <tbody>
              {pagos.map((p) => (
                <tr key={p.id}><td className="mono">{fechaHora(p.fecha)}</td><td>{p.proveedor_nombre}</td><td className="mono" style={{ fontWeight: 700 }}>{bs(p.monto)}</td></tr>
              ))}
              {pagos.length === 0 && <tr><td colSpan={3} style={{ textAlign: "center", color: "var(--text-muted)" }}>{cargando ? "Cargando..." : "Sin pagos en este período"}</td></tr>}
            </tbody>
          </table>
        )}

        {vista === "resumen" && (
          <table className="table">
            <thead><tr><th>Proveedor</th><th>Compras</th><th>Unidades</th><th>Total comprado</th></tr></thead>
            <tbody>
              {porProveedor.map((r) => (
                <tr key={r.nombre}><td>{r.nombre}</td><td className="mono">{r.compras}</td><td className="mono">{r.unidades}</td><td className="mono" style={{ fontWeight: 700 }}>{bs(r.total)}</td></tr>
              ))}
              {porProveedor.length === 0 && <tr><td colSpan={4} style={{ textAlign: "center", color: "var(--text-muted)" }}>{cargando ? "Cargando..." : "Sin compras en este período"}</td></tr>}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
