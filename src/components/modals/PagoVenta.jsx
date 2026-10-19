import { useState } from "react";
import { api } from "../../api.js";

export default function PagoVenta({ deuda, onGuardado, onCancelar }) {
  const [monto, setMonto] = useState("");
  const [guardando, setGuardando] = useState(false);

  async function pagar(e) {
    e.preventDefault();
    setGuardando(true);
    try {
      await api.registrarPagoVenta(deuda.venta_id, parseFloat(monto));
      onGuardado();
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal-box">
        <h2>Abono — {deuda.cliente_nombre}</h2>
        <p style={{ marginBottom: 14, color: "var(--text-muted)" }}>
          Saldo pendiente: <span className="mono" style={{ fontWeight: 700, color: "var(--text-main)" }}>Bs {deuda.saldo.toFixed(2)}</span>
        </p>
        <form onSubmit={pagar}>
          <div className="field">
            <label className="label">Monto a abonar (Bs)</label>
            <input className="input mono" type="number" step="0.01" max={deuda.saldo} value={monto} onChange={(e) => setMonto(e.target.value)} autoFocus required />
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onCancelar}>Cancelar</button>
            <button className="btn btn-primary" disabled={guardando}>{guardando ? "Guardando..." : "Registrar abono"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
