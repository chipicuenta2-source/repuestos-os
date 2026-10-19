import { useState } from "react";
import { api } from "../../api.js";

export default function NuevaCompra({ proveedor, productos, onGuardada, onCancelar }) {
  const [items, setItems] = useState([{ producto_id: "", cantidad: 1, costo_unitario: "" }]);
  const [esCredito, setEsCredito] = useState(true);
  const [guardando, setGuardando] = useState(false);

  function actualizarItem(idx, cambios) {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...cambios } : it)));
  }

  function agregarFila() {
    setItems((prev) => [...prev, { producto_id: "", cantidad: 1, costo_unitario: "" }]);
  }

  function quitarFila(idx) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  const total = items.reduce((acc, i) => acc + (parseFloat(i.costo_unitario) || 0) * (parseInt(i.cantidad, 10) || 0), 0);

  async function guardar(e) {
    e.preventDefault();
    setGuardando(true);
    try {
      await api.registrarCompra({
        proveedor_id: proveedor.id,
        es_credito: esCredito,
        items: items
          .filter((i) => i.producto_id)
          .map((i) => ({
            producto_id: parseInt(i.producto_id, 10),
            cantidad: parseInt(i.cantidad, 10) || 0,
            costo_unitario: parseFloat(i.costo_unitario) || 0,
          })),
      });
      onGuardada();
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal-box" style={{ maxWidth: 620 }}>
        <h2>Nueva compra — {proveedor.nombre}</h2>
        <form onSubmit={guardar}>
          {items.map((item, idx) => (
            <div key={idx} className="field-row" style={{ alignItems: "flex-end" }}>
              <div className="field" style={{ flex: 2 }}>
                <label className="label">Producto</label>
                <select className="input" value={item.producto_id} onChange={(e) => actualizarItem(idx, { producto_id: e.target.value })} required>
                  <option value="">Seleccionar...</option>
                  {productos.map((p) => <option key={p.id} value={p.id}>{p.nombre} ({p.codigo || p.oem})</option>)}
                </select>
              </div>
              <div className="field">
                <label className="label">Cantidad</label>
                <input className="input mono" type="number" min="1" value={item.cantidad} onChange={(e) => actualizarItem(idx, { cantidad: e.target.value })} />
              </div>
              <div className="field">
                <label className="label">Costo unit.</label>
                <input className="input mono" type="number" step="0.01" value={item.costo_unitario} onChange={(e) => actualizarItem(idx, { costo_unitario: e.target.value })} />
              </div>
              <button type="button" className="btn btn-danger btn-sm" style={{ marginBottom: 14 }} onClick={() => quitarFila(idx)}>✕</button>
            </div>
          ))}
          <button type="button" className="btn btn-secondary btn-sm" onClick={agregarFila} style={{ marginBottom: 16 }}>+ Agregar producto</button>

          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, marginBottom: 14 }}>
            <input type="checkbox" checked={esCredito} onChange={(e) => setEsCredito(e.target.checked)} />
            Compra a crédito (se suma a la cuenta corriente del proveedor)
          </label>

          <div style={{ fontWeight: 700, marginBottom: 14 }}>Total: <span className="mono">Bs {total.toFixed(2)}</span></div>

          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onCancelar}>Cancelar</button>
            <button className="btn btn-primary" disabled={guardando}>{guardando ? "Guardando..." : "Registrar compra"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
