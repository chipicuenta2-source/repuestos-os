import { useEffect, useMemo, useState } from "react";
import { api } from "../../api.js";
import NotaVenta from "../modals/NotaVenta.jsx";
import { fechaHora, fechaIso, hace } from "../etiquetasAuditoria.js";

// Cajero: "Mis ventas" (solo las suyas, lo garantiza el servidor). Admin: todas, con filtro por cajero.
export default function Ventas({ usuario }) {
  const esAdmin = usuario.rol === "admin";
  const [ventas, setVentas] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [usuarioId, setUsuarioId] = useState("");
  const [desde, setDesde] = useState(fechaIso());
  const [hasta, setHasta] = useState(fechaIso());
  const [nota, setNota] = useState(null);
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    if (esAdmin) api.listarUsuarios().then(setUsuarios);
  }, [esAdmin]);

  async function cargar() {
    setCargando(true);
    try {
      const r = await api.listarVentas({
        usuarioId: usuarioId ? parseInt(usuarioId, 10) : null,
        desde: desde || null,
        hasta: hasta || null,
      });
      setVentas(r);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuarioId, desde, hasta]);

  const total = useMemo(() => ventas.reduce((a, v) => a + v.monto_total, 0), [ventas]);
  const cobrado = useMemo(() => ventas.reduce((a, v) => a + v.monto_abonado, 0), [ventas]);

  async function verNota(v) {
    const items = await api.listarItemsVenta(v.id);
    setNota({ ...v, items });
  }

  function rapido(dias) {
    setDesde(hace(dias));
    setHasta(fechaIso());
  }

  return (
    <div className="view-scroll">
      <h1 className="font-title" style={{ fontSize: 19, textTransform: "uppercase", marginBottom: 16 }}>
        {esAdmin ? "Ventas realizadas" : "Mis ventas"}
      </h1>

      <div className="filters-grid">
        {esAdmin && (
          <div className="field">
            <label className="label">Cajero</label>
            <select className="input" value={usuarioId} onChange={(e) => setUsuarioId(e.target.value)}>
              <option value="">Todos</option>
              {usuarios.map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}
            </select>
          </div>
        )}
        <div className="field">
          <label className="label">Desde</label>
          <input className="input" type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
        </div>
        <div className="field">
          <label className="label">Hasta</label>
          <input className="input" type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
        </div>
        <div className="chips-row" style={{ marginBottom: 0 }}>
          <div className="chip" onClick={() => rapido(0)}>Hoy</div>
          <div className="chip" onClick={() => rapido(7)}>7 días</div>
          <div className="chip" onClick={() => rapido(30)}>30 días</div>
          <div className="chip" onClick={() => { setDesde(""); setHasta(""); }}>Todo</div>
        </div>
      </div>

      <div className="kpi-row">
        <div className="kpi-card"><div className="kpi-label">Ventas</div><div className="kpi-value mono">{ventas.length}</div></div>
        <div className="kpi-card"><div className="kpi-label">Total vendido</div><div className="kpi-value mono">Bs {total.toFixed(2)}</div></div>
        <div className="kpi-card"><div className="kpi-label">Cobrado</div><div className="kpi-value mono">Bs {cobrado.toFixed(2)}</div></div>
        <div className="kpi-card"><div className="kpi-label">Ticket promedio</div><div className="kpi-value mono">Bs {(ventas.length ? total / ventas.length : 0).toFixed(2)}</div></div>
      </div>

      <div className="card" style={{ padding: 0, overflowX: "auto" }}>
        <table className="table">
          <thead>
            <tr><th>#</th><th>Fecha</th>{esAdmin && <th>Cajero</th>}<th>Cliente / comprador</th><th>Tipo</th><th>Pago</th><th>Unid.</th><th>Total</th><th></th></tr>
          </thead>
          <tbody>
            {ventas.map((v) => (
              <tr key={v.id}>
                <td className="mono">{v.id}</td>
                <td style={{ whiteSpace: "nowrap" }} className="mono">{fechaHora(v.fecha)}</td>
                {esAdmin && <td>{v.usuario_nombre}</td>}
                <td>{v.cliente_nombre || v.nombre_comprador || "—"}</td>
                <td>
                  <span className={`badge ${v.es_facturado ? "badge-orange" : "badge-blue"}`}>{v.es_facturado ? "Factura" : "Sin factura"}</span>{" "}
                  {v.es_credito && <span className="badge badge-red">{v.monto_abonado >= v.monto_total - 0.005 ? "Crédito pagado" : "Crédito"}</span>}
                </td>
                <td>{v.metodo_pago === "qr" ? "QR" : "Efectivo"}</td>
                <td className="mono">{v.cantidad_items}</td>
                <td className="mono" style={{ fontWeight: 700 }}>Bs {v.monto_total.toFixed(2)}</td>
                <td><button className="btn btn-secondary btn-sm" onClick={() => verNota(v)}>Ver nota</button></td>
              </tr>
            ))}
            {ventas.length === 0 && (
              <tr><td colSpan={esAdmin ? 9 : 8} style={{ textAlign: "center", color: "var(--text-muted)" }}>{cargando ? "Cargando..." : "No hay ventas en este período"}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {nota && <NotaVenta venta={nota} onClose={() => setNota(null)} />}
    </div>
  );
}
