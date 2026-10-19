import { useEffect, useState } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { api } from "../../api.js";
import { ACCIONES, etiquetaAccion, fechaHora, fechaIso, hace } from "../etiquetasAuditoria.js";

export default function Historial() {
  const [eventos, setEventos] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [usuarioId, setUsuarioId] = useState("");
  const [accion, setAccion] = useState("");
  const [desde, setDesde] = useState(hace(7));
  const [hasta, setHasta] = useState(fechaIso());
  const [texto, setTexto] = useState("");
  const [cargando, setCargando] = useState(false);
  const [mensajePdf, setMensajePdf] = useState("");

  useEffect(() => {
    api.listarUsuarios().then(setUsuarios);
  }, []);

  async function cargar() {
    setCargando(true);
    try {
      const r = await api.listarAuditoria({
        usuario_id: usuarioId ? parseInt(usuarioId, 10) : null,
        accion: accion || null,
        desde: desde || null,
        hasta: hasta || null,
        texto: texto || null,
        limite: 1000,
      });
      setEventos(r);
    } finally {
      setCargando(false);
    }
  }

  // Se recarga al cambiar cualquier filtro (el texto con una pequeña pausa para no consultar en cada tecla)
  useEffect(() => {
    const t = setTimeout(cargar, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuarioId, accion, desde, hasta, texto]);

  function rapido(dias) {
    setDesde(hace(dias));
    setHasta(fechaIso());
  }

  function exportarPDF() {
    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(15);
    doc.text("REPUESTOS OS - Historial de actividad", 14, 14);
    doc.setFontSize(9);
    doc.text(`Del ${desde || "inicio"} al ${hasta || "hoy"} · generado ${new Date().toLocaleString("es-BO")}`, 14, 20);
    autoTable(doc, {
      startY: 25,
      head: [["Fecha", "Usuario", "Acción", "Detalle"]],
      body: eventos.map((e) => [fechaHora(e.fecha), e.usuario_nombre || "—", etiquetaAccion(e.accion).texto, e.detalle || ""]),
      styles: { fontSize: 8, cellPadding: 1.8 },
      columnStyles: { 0: { cellWidth: 32 }, 1: { cellWidth: 42 }, 2: { cellWidth: 40 } },
    });
    doc.save(`historial-${fechaIso()}.pdf`);
    setMensajePdf("✓ PDF descargado. Revisa la carpeta de Descargas de tu equipo.");
  }

  return (
    <div className="view-scroll">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <h1 className="font-title" style={{ fontSize: 19, textTransform: "uppercase" }}>Historial de actividad</h1>
        <button className="btn btn-secondary" onClick={exportarPDF} disabled={eventos.length === 0}>Exportar PDF</button>
      </div>
      <p style={{ fontSize: 12.5, color: "var(--text-muted)", marginBottom: 16 }}>
        Quién hizo cada venta, cambio de precio o stock, compra, pago y más. Los registros no se pueden editar ni borrar.
      </p>
      {mensajePdf && <div className="ok-msg">{mensajePdf}</div>}

      <div className="filters-grid">
        <div className="field">
          <label className="label">Usuario</label>
          <select className="input" value={usuarioId} onChange={(e) => setUsuarioId(e.target.value)}>
            <option value="">Todos</option>
            {usuarios.map((u) => <option key={u.id} value={u.id}>{u.nombre} ({u.usuario})</option>)}
          </select>
        </div>
        <div className="field">
          <label className="label">Acción</label>
          <select className="input" value={accion} onChange={(e) => setAccion(e.target.value)}>
            <option value="">Todas</option>
            {Object.entries(ACCIONES).map(([k, v]) => <option key={k} value={k}>{v.texto}</option>)}
          </select>
        </div>
        <div className="field">
          <label className="label">Desde</label>
          <input className="input" type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
        </div>
        <div className="field">
          <label className="label">Hasta</label>
          <input className="input" type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label className="label">Buscar en el detalle</label>
          <input className="input" placeholder="Ej: amortiguador, Bs 730, precio venta..." value={texto} onChange={(e) => setTexto(e.target.value)} />
        </div>
      </div>

      <div className="chips-row">
        <div className="chip" onClick={() => rapido(0)}>Hoy</div>
        <div className="chip" onClick={() => rapido(7)}>7 días</div>
        <div className="chip" onClick={() => rapido(30)}>30 días</div>
        <div className="chip" onClick={() => { setDesde(""); setHasta(""); }}>Todo</div>
      </div>

      <div className="card" style={{ padding: 0, overflowX: "auto" }}>
        <table className="table">
          <thead><tr><th>Fecha</th><th>Usuario</th><th>Acción</th><th>Detalle</th></tr></thead>
          <tbody>
            {eventos.map((e) => {
              const a = etiquetaAccion(e.accion);
              return (
                <tr key={e.id}>
                  <td style={{ whiteSpace: "nowrap" }} className="mono">{fechaHora(e.fecha)}</td>
                  <td>{e.usuario_nombre || <span style={{ color: "var(--text-muted)" }}>—</span>}</td>
                  <td><span className={`action-badge ${a.clase}`}>{a.texto}</span></td>
                  <td>{e.detalle}</td>
                </tr>
              );
            })}
            {eventos.length === 0 && (
              <tr><td colSpan={4} style={{ textAlign: "center", color: "var(--text-muted)" }}>{cargando ? "Cargando..." : "Sin registros para estos filtros"}</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {eventos.length >= 1000 && (
        <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 8 }}>Se muestran los 1000 más recientes. Acota las fechas para ver otros.</p>
      )}
    </div>
  );
}
