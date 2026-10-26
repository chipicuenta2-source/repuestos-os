import { useState } from "react";
import { api } from "../../api.js";

function Fila({ t, v }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "1px 0" }}>
      <span>{t}</span><span className="mono">Bs {(v || 0).toFixed(2)}</span>
    </div>
  );
}

export default function CerrarCaja({ cajaSesion, onCerrada, onCancelar }) {
  const [montoContado, setMontoContado] = useState("");
  const [cargando, setCargando] = useState(false);
  const [resultado, setResultado] = useState(null);

  const cerrar = async (e) => {
    e.preventDefault();
    setCargando(true);
    const sesion = await api.cerrarCaja(cajaSesion.id, parseFloat(montoContado || "0"));
    setResultado(sesion);
    setCargando(false);
  };

  const diferencia = resultado ? resultado.monto_contado - resultado.monto_esperado : 0;

  return (
    <div className="modal-overlay">
      <div className="modal-box">
        <h2>Cierre de caja</h2>
        {!resultado ? (
          <form onSubmit={cerrar}>
            <div className="field">
              <label className="label">Monto apertura</label>
              <input className="input mono" value={`Bs ${cajaSesion.monto_apertura.toFixed(2)}`} disabled />
            </div>
            <div className="field">
              <label className="label">Monto contado en caja (Bs)</label>
              <input
                className="input mono"
                type="number"
                step="0.01"
                value={montoContado}
                onChange={(e) => setMontoContado(e.target.value)}
                autoFocus
                required
              />
            </div>
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={onCancelar}>Cancelar</button>
              <button className="btn btn-primary" disabled={cargando}>{cargando ? "Cerrando..." : "Confirmar cierre"}</button>
            </div>
          </form>
        ) : (
          <div>
            <div className="card" style={{ marginBottom: 10, fontSize: 13 }}>
              <div className="label" style={{ marginBottom: 6 }}>Efectivo en caja</div>
              <Fila t="Apertura" v={resultado.monto_apertura} />
              <Fila t="+ Ventas en efectivo" v={resultado.ventas_efectivo} />
              <Fila t="+ Cobros de deudas en efectivo" v={resultado.cobros_efectivo} />
              <Fila t="+ Otros ingresos" v={resultado.otros_ingresos} />
              <Fila t="− Otros egresos" v={resultado.otros_egresos} />
            </div>
            <div className="card" style={{ marginBottom: 12, fontSize: 13 }}>
              <div className="label" style={{ marginBottom: 6 }}>Cobrado por QR (no entra al efectivo)</div>
              <Fila t="Ventas por QR" v={resultado.ventas_qr} />
              <Fila t="Cobros de deudas por QR" v={resultado.cobros_qr} />
            </div>
            <div className="field">
              <span className="label">Monto esperado</span>
              <div className="mono" style={{ fontSize: 18, fontWeight: 700 }}>Bs {resultado.monto_esperado.toFixed(2)}</div>
            </div>
            <div className="field">
              <span className="label">Monto contado</span>
              <div className="mono" style={{ fontSize: 18, fontWeight: 700 }}>Bs {resultado.monto_contado.toFixed(2)}</div>
            </div>
            <div className={diferencia === 0 ? "ok-msg" : "error-msg"}>
              {diferencia === 0
                ? "✓ Caja cuadrada, sin diferencias."
                : `Diferencia: ${diferencia > 0 ? "sobrante" : "faltante"} de Bs ${Math.abs(diferencia).toFixed(2)}`}
            </div>
            <div className="modal-actions">
              <button className="btn btn-primary" onClick={() => onCerrada(resultado)}>Finalizar turno</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
