import { useEffect, useState } from "react";
import { api } from "../../api.js";

export default function HistorialProveedor({ proveedor, onClose }) {
  const [movimientos, setMovimientos] = useState([]);
  const [monto, setMonto] = useState("");

  useEffect(() => { cargar(); }, []);
  function cargar() {
    api.listarMovimientosProveedor(proveedor.id).then(setMovimientos);
  }

  async function pagar(e) {
    e.preventDefault();
    if (!monto) return;
    await api.registrarPagoProveedor(proveedor.id, parseFloat(monto));
    setMonto("");
    cargar();
  }

  return (
    <div className="modal-overlay">
      <div className="modal-box">
        <h2>{proveedor.nombre} — Cuenta corriente</h2>
        <div style={{ marginBottom: 14 }}>
          Saldo actual: <span className="mono" style={{ fontWeight: 700 }}>Bs {proveedor.saldo.toFixed(2)}</span>
        </div>
        <form onSubmit={pagar} style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <input className="input mono" type="number" step="0.01" placeholder="Monto a pagar" value={monto} onChange={(e) => setMonto(e.target.value)} />
          <button className="btn btn-primary btn-sm">Registrar pago</button>
        </form>
        <table className="table">
          <thead><tr><th>Fecha</th><th>Tipo</th><th>Monto</th></tr></thead>
          <tbody>
            {movimientos.map((m) => (
              <tr key={m.id}>
                <td>{new Date(m.fecha).toLocaleString()}</td>
                <td>{m.tipo === "compra_credito" ? "Compra a crédito" : "Pago realizado"}</td>
                <td className="mono">{m.tipo === "compra_credito" ? "+" : "-"}Bs {m.monto.toFixed(2)}</td>
              </tr>
            ))}
            {movimientos.length === 0 && <tr><td colSpan={3} style={{ textAlign: "center", color: "var(--text-muted)" }}>Sin movimientos</td></tr>}
          </tbody>
        </table>
        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}
