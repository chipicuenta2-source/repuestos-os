import { useEffect, useMemo, useState } from "react";
import { api } from "../../api.js";
import { fechaIso, hace } from "../etiquetasAuditoria.js";

const fmtFecha = (f) => f.split("-").reverse().join("/");

// Otros ingresos (suman a la caja) y otros egresos (restan de la caja), en la fecha que corresponde.
export default function Movimientos({ usuario }) {
  const esAdmin = usuario.rol === "admin";
  const [lista, setLista] = useState([]);
  const [tipo, setTipo] = useState("ingreso");
  const [fecha, setFecha] = useState(fechaIso());
  const [concepto, setConcepto] = useState("");
  const [monto, setMonto] = useState("");
  const [desde, setDesde] = useState(fechaIso());
  const [hasta, setHasta] = useState(fechaIso());
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [guardando, setGuardando] = useState(false);

  async function cargar() {
    setLista(await api.listarMovimientosCaja({ desde: desde || null, hasta: hasta || null }));
  }
  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [desde, hasta]);

  const ingresos = useMemo(() => lista.filter((m) => m.tipo === "ingreso").reduce((a, m) => a + m.monto, 0), [lista]);
  const egresos = useMemo(() => lista.filter((m) => m.tipo === "egreso").reduce((a, m) => a + m.monto, 0), [lista]);

  async function guardar(e) {
    e.preventDefault();
    setError(""); setOk("");
    setGuardando(true);
    try {
      await api.registrarMovimientoCaja({ tipo, fecha, concepto, monto: parseFloat(monto) || 0 });
      setOk(tipo === "ingreso" ? "✓ Ingreso registrado: se suma a la caja." : "✓ Egreso registrado: se resta de la caja.");
      setConcepto(""); setMonto("");
      // si se registró fuera del rango visible, ampliar para que se vea
      if ((desde && fecha < desde) || (hasta && fecha > hasta)) { setDesde(fecha < (desde || fecha) ? fecha : desde); setHasta(fecha > (hasta || fecha) ? fecha : hasta); }
      else await cargar();
    } catch (err) {
      setError(typeof err === "string" ? err : err?.message || "No se pudo registrar");
    } finally {
      setGuardando(false);
    }
  }

  async function eliminar(m) {
    setError(""); setOk("");
    try {
      await api.eliminarMovimientoCaja(m.id);
      await cargar();
    } catch (err) {
      setError(typeof err === "string" ? err : err?.message || "No se pudo eliminar");
    }
  }

  function rapido(dias) { setDesde(hace(dias)); setHasta(fechaIso()); }

  return (
    <div className="view-scroll">
      <h1 className="font-title" style={{ fontSize: 19, textTransform: "uppercase", marginBottom: 6 }}>Otros ingresos y egresos</h1>
      <p style={{ fontSize: 12.5, color: "var(--text-muted)", marginBottom: 16 }}>
        Los <b>ingresos</b> suman a la caja y los <b>egresos</b> restan, en la fecha indicada. Se incluyen en el cierre de caja.
      </p>

      <div className="card" style={{ marginBottom: 18 }}>
        {error && <div className="error-msg">{error}</div>}
        {ok && <div className="ok-msg">{ok}</div>}
        <div className="factura-toggle" style={{ maxWidth: 320, marginBottom: 14 }}>
          <button type="button" className={`${tipo === "ingreso" ? "active on" : ""}`} onClick={() => setTipo("ingreso")}>+ Ingreso</button>
          <button type="button" className={`${tipo === "egreso" ? "active" : ""}`} onClick={() => setTipo("egreso")}>− Egreso</button>
        </div>
        <form onSubmit={guardar} className="filters-grid" style={{ marginBottom: 0 }}>
          <div className="field">
            <label className="label">Fecha</label>
            <input className="input" type="date" value={fecha} max={fechaIso()} onChange={(e) => setFecha(e.target.value)} required disabled={!esAdmin} title={esAdmin ? "" : "Solo un administrador puede usar otra fecha"} />
          </div>
          <div className="field" style={{ flex: 1, minWidth: 220 }}>
            <label className="label">Concepto</label>
            <input className="input" value={concepto} onChange={(e) => setConcepto(e.target.value)} placeholder={tipo === "ingreso" ? "Ej: Aporte, cambio, cobro extra" : "Ej: Almuerzo, pasajes, pago de luz"} required autoComplete="off" />
          </div>
          <div className="field" style={{ width: 150 }}>
            <label className="label">Monto (Bs)</label>
            <input className="input mono" type="number" step="0.01" min="0.01" value={monto} onChange={(e) => setMonto(e.target.value)} required />
          </div>
          <button type="submit" className="btn btn-primary" style={{ marginBottom: 14 }} disabled={guardando}>
            {guardando ? "Guardando..." : tipo === "ingreso" ? "Registrar ingreso" : "Registrar egreso"}
          </button>
        </form>
      </div>

      <div className="filters-grid">
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
        <div className="kpi-card"><div className="kpi-label">Ingresos</div><div className="kpi-value mono" style={{ color: "var(--green-ok)" }}>Bs {ingresos.toFixed(2)}</div></div>
        <div className="kpi-card"><div className="kpi-label">Egresos</div><div className="kpi-value mono" style={{ color: "var(--red-danger)" }}>Bs {egresos.toFixed(2)}</div></div>
        <div className="kpi-card"><div className="kpi-label">Neto en caja</div><div className="kpi-value mono">Bs {(ingresos - egresos).toFixed(2)}</div></div>
      </div>

      <div className="card" style={{ padding: 0, overflowX: "auto" }}>
        <table className="table">
          <thead><tr><th>Fecha</th><th>Tipo</th><th>Concepto</th>{esAdmin && <th>Registró</th>}<th style={{ textAlign: "right" }}>Monto</th>{esAdmin && <th></th>}</tr></thead>
          <tbody>
            {lista.map((m) => (
              <tr key={m.id}>
                <td className="mono" style={{ whiteSpace: "nowrap" }}>{fmtFecha(m.fecha)}</td>
                <td><span className={`action-badge ${m.tipo === "ingreso" ? "act-ok" : "act-bad"}`}>{m.tipo === "ingreso" ? "Ingreso" : "Egreso"}</span></td>
                <td>{m.concepto}</td>
                {esAdmin && <td>{m.usuario_nombre}</td>}
                <td className="mono" style={{ textAlign: "right", fontWeight: 700, color: m.tipo === "ingreso" ? "var(--green-ok)" : "var(--red-danger)" }}>
                  {m.tipo === "ingreso" ? "+" : "−"} Bs {m.monto.toFixed(2)}
                </td>
                {esAdmin && <td><button className="btn btn-secondary btn-sm" onClick={() => eliminar(m)}>Eliminar</button></td>}
              </tr>
            ))}
            {lista.length === 0 && <tr><td colSpan={esAdmin ? 6 : 4} style={{ textAlign: "center", color: "var(--text-muted)" }}>Sin movimientos en este período</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
