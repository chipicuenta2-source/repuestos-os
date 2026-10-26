import { useEffect, useMemo, useState } from "react";
import { api } from "../../api.js";
import { fechaIso, hace } from "../etiquetasAuditoria.js";

const fmtFecha = (f) => f.split("-").reverse().join("/");

// Otros ingresos (suman a la caja) y otros egresos (restan de la caja), en la fecha que corresponde.
// Mismo formato que la pantalla de Ventas: filtros, totales y tabla.
export default function Movimientos({ usuario }) {
  const esAdmin = usuario.rol === "admin";
  const [lista, setLista] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [usuarioId, setUsuarioId] = useState("");
  const [tipoFiltro, setTipoFiltro] = useState("");
  const [desde, setDesde] = useState(fechaIso());
  const [hasta, setHasta] = useState(fechaIso());
  const [nuevo, setNuevo] = useState(null); // "ingreso" | "egreso" | null
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");

  useEffect(() => {
    if (esAdmin) api.listarUsuarios().then(setUsuarios);
  }, [esAdmin]);

  async function cargar() {
    setLista(await api.listarMovimientosCaja({
      desde: desde || null,
      hasta: hasta || null,
      tipo: tipoFiltro || null,
      usuarioId: usuarioId ? parseInt(usuarioId, 10) : null,
    }));
  }
  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [desde, hasta, tipoFiltro, usuarioId]);

  const ingresos = useMemo(() => lista.filter((m) => m.tipo === "ingreso").reduce((a, m) => a + m.monto, 0), [lista]);
  const egresos = useMemo(() => lista.filter((m) => m.tipo === "egreso").reduce((a, m) => a + m.monto, 0), [lista]);

  function rapido(dias) { setDesde(hace(dias)); setHasta(fechaIso()); }

  async function eliminar(m) {
    setError(""); setAviso("");
    try {
      await api.eliminarMovimientoCaja(m.id);
      await cargar();
    } catch (err) {
      setError(typeof err === "string" ? err : err?.message || "No se pudo eliminar");
    }
  }

  function guardado(m) {
    setNuevo(null);
    setAviso(m.tipo === "ingreso" ? "✓ Ingreso registrado: se suma a la caja." : "✓ Egreso registrado: se resta de la caja.");
    // si quedó fuera del rango visible, ampliarlo para que se vea
    if ((desde && m.fecha < desde) || (hasta && m.fecha > hasta)) {
      if (desde && m.fecha < desde) setDesde(m.fecha);
      if (hasta && m.fecha > hasta) setHasta(m.fecha);
    } else cargar();
  }

  return (
    <div className="view-scroll">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, gap: 10, flexWrap: "wrap" }}>
        <h1 className="font-title" style={{ fontSize: 19, textTransform: "uppercase" }}>Otros ingresos y egresos</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-primary" onClick={() => { setNuevo("ingreso"); setError(""); setAviso(""); }}>+ Ingreso</button>
          <button className="btn btn-secondary" onClick={() => { setNuevo("egreso"); setError(""); setAviso(""); }}>− Egreso</button>
        </div>
      </div>
      {error && <div className="error-msg">{error}</div>}
      {aviso && <div className="ok-msg">{aviso}</div>}

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
          <label className="label">Tipo</label>
          <select className="input" value={tipoFiltro} onChange={(e) => setTipoFiltro(e.target.value)}>
            <option value="">Ingresos y egresos</option>
            <option value="ingreso">Solo ingresos</option>
            <option value="egreso">Solo egresos</option>
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
      </div>

      <div className="kpi-row">
        <div className="kpi-card"><div className="kpi-label">Movimientos</div><div className="kpi-value mono">{lista.length}</div></div>
        <div className="kpi-card"><div className="kpi-label">Ingresos</div><div className="kpi-value mono" style={{ color: "var(--green-ok)" }}>Bs {ingresos.toFixed(2)}</div></div>
        <div className="kpi-card"><div className="kpi-label">Egresos</div><div className="kpi-value mono" style={{ color: "var(--red-danger)" }}>Bs {egresos.toFixed(2)}</div></div>
        <div className="kpi-card"><div className="kpi-label">Neto en caja</div><div className="kpi-value mono">Bs {(ingresos - egresos).toFixed(2)}</div></div>
      </div>

      <div className="card" style={{ padding: 0, overflowX: "auto" }}>
        <table className="table">
          <thead>
            <tr><th>#</th><th>Fecha</th>{esAdmin && <th>Cajero</th>}<th>Tipo</th><th>Concepto</th><th>Monto</th>{esAdmin && <th></th>}</tr>
          </thead>
          <tbody>
            {lista.map((m) => (
              <tr key={m.id}>
                <td className="mono">{m.id}</td>
                <td className="mono" style={{ whiteSpace: "nowrap" }}>{fmtFecha(m.fecha)}</td>
                {esAdmin && <td>{m.usuario_nombre}</td>}
                <td><span className={`action-badge ${m.tipo === "ingreso" ? "act-ok" : "act-bad"}`}>{m.tipo === "ingreso" ? "Ingreso" : "Egreso"}</span></td>
                <td>{m.concepto}</td>
                <td className="mono" style={{ fontWeight: 700, color: m.tipo === "ingreso" ? "var(--green-ok)" : "var(--red-danger)" }}>
                  {m.tipo === "ingreso" ? "+" : "−"} Bs {m.monto.toFixed(2)}
                </td>
                {esAdmin && <td><button className="btn btn-secondary btn-sm" onClick={() => eliminar(m)}>Eliminar</button></td>}
              </tr>
            ))}
            {lista.length === 0 && (
              <tr><td colSpan={esAdmin ? 7 : 5} style={{ textAlign: "center", color: "var(--text-muted)" }}>Sin movimientos en este período</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {nuevo && <FormMovimiento tipoInicial={nuevo} esAdmin={esAdmin} onClose={() => setNuevo(null)} onGuardado={guardado} />}
    </div>
  );
}

function FormMovimiento({ tipoInicial, esAdmin, onClose, onGuardado }) {
  const [tipo, setTipo] = useState(tipoInicial);
  const [fecha, setFecha] = useState(fechaIso());
  const [concepto, setConcepto] = useState("");
  const [monto, setMonto] = useState("");
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);

  async function guardar(e) {
    e.preventDefault();
    setError("");
    setGuardando(true);
    try {
      const m = await api.registrarMovimientoCaja({ tipo, fecha, concepto, monto: parseFloat(monto) || 0 });
      onGuardado(m);
    } catch (err) {
      setError(typeof err === "string" ? err : err?.message || "No se pudo registrar");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal-box" style={{ width: 440 }}>
        <h2>{tipo === "ingreso" ? "Nuevo ingreso" : "Nuevo egreso"}</h2>
        <p style={{ fontSize: 12.5, color: "var(--text-muted)", marginBottom: 12 }}>
          {tipo === "ingreso" ? "Suma dinero a la caja." : "Resta dinero de la caja."}
        </p>
        {error && <div className="error-msg">{error}</div>}
        <div className="factura-toggle" style={{ marginBottom: 14 }}>
          <button type="button" className={tipo === "ingreso" ? "active on" : ""} onClick={() => setTipo("ingreso")}>+ Ingreso</button>
          <button type="button" className={tipo === "egreso" ? "active" : ""} onClick={() => setTipo("egreso")}>− Egreso</button>
        </div>
        <form onSubmit={guardar}>
          <div className="field">
            <label className="label">Fecha</label>
            <input className="input" type="date" value={fecha} max={fechaIso()} onChange={(e) => setFecha(e.target.value)} required disabled={!esAdmin} />
            {!esAdmin && <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>Solo un administrador puede usar otra fecha.</div>}
          </div>
          <div className="field">
            <label className="label">Concepto</label>
            <input className="input" value={concepto} onChange={(e) => setConcepto(e.target.value)} placeholder={tipo === "ingreso" ? "Ej: Aporte, cambio, cobro extra" : "Ej: Almuerzo, pasajes, pago de luz"} required autoFocus autoComplete="off" />
          </div>
          <div className="field">
            <label className="label">Monto (Bs)</label>
            <input className="input mono" type="number" step="0.01" min="0.01" value={monto} onChange={(e) => setMonto(e.target.value)} required />
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
            <button className="btn btn-primary" disabled={guardando}>{guardando ? "Guardando..." : tipo === "ingreso" ? "Registrar ingreso" : "Registrar egreso"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
