import { useState } from "react";
import { api } from "../../api.js";

const vacio = {
  codigo: "", oem: "", nombre: "", detalle: "", marca: "", procedencia: "",
  categoria_id: "", estante: "", etiqueta: "", unidad: "PIEZA",
  stock: 0, stock_minimo: 2, precio_venta: 0, precio_facturado: 0, imagen: null,
};

export default function ProductoForm({ productoExistente, categorias, onGuardado, onCancelar }) {
  const [form, setForm] = useState(
    productoExistente
      ? { ...vacio, ...productoExistente, categoria_id: productoExistente.categoria_id || "" }
      : vacio
  );
  const [guardando, setGuardando] = useState(false);

  function campo(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function guardar(e) {
    e.preventDefault();
    setGuardando(true);
    const payload = {
      codigo: form.codigo || null,
      oem: form.oem || null,
      nombre: form.nombre,
      detalle: form.detalle || null,
      marca: form.marca || null,
      procedencia: form.procedencia || null,
      categoria_id: form.categoria_id ? parseInt(form.categoria_id, 10) : null,
      estante: form.estante || null,
      etiqueta: form.etiqueta || null,
      unidad: form.unidad || "PIEZA",
      stock: parseInt(form.stock, 10) || 0,
      stock_minimo: parseInt(form.stock_minimo, 10) || 0,
      precio_venta: parseFloat(form.precio_venta) || 0,
      precio_facturado: parseFloat(form.precio_facturado) || 0,
      imagen: form.imagen || null,
    };
    try {
      if (productoExistente) {
        await api.actualizarProducto(productoExistente.id, payload);
      } else {
        await api.crearProducto(payload);
      }
      onGuardado();
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal-box" style={{ maxWidth: 640 }}>
        <h2>{productoExistente ? "Editar producto" : "Nuevo producto"}</h2>
        <form onSubmit={guardar}>
          <div className="field">
            <label className="label">Nombre</label>
            <input className="input" value={form.nombre} onChange={(e) => campo("nombre", e.target.value)} required />
          </div>
          <div className="field">
            <label className="label">Detalle / Compatibilidad</label>
            <textarea className="input" rows={2} value={form.detalle || ""} onChange={(e) => campo("detalle", e.target.value)} placeholder="Ej: SUZUKI VITARA 95- 1.6 M16A, lado derecho" />
          </div>
          <div className="field-row">
            <div className="field">
              <label className="label">Código interno</label>
              <input className="input mono" value={form.codigo || ""} onChange={(e) => campo("codigo", e.target.value)} />
            </div>
            <div className="field">
              <label className="label">Código OEM</label>
              <input className="input mono" value={form.oem || ""} onChange={(e) => campo("oem", e.target.value)} />
            </div>
          </div>
          <div className="field-row">
            <div className="field">
              <label className="label">Marca</label>
              <input className="input" value={form.marca || ""} onChange={(e) => campo("marca", e.target.value)} />
            </div>
            <div className="field">
              <label className="label">Procedencia</label>
              <input className="input" value={form.procedencia || ""} onChange={(e) => campo("procedencia", e.target.value)} />
            </div>
          </div>
          <div className="field">
            <label className="label">Categoría</label>
            <select className="input" value={form.categoria_id || ""} onChange={(e) => campo("categoria_id", e.target.value)}>
              <option value="">Sin categoría</option>
              {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>
          <div className="field-row">
            <div className="field">
              <label className="label">Estante</label>
              <input className="input" value={form.estante || ""} onChange={(e) => campo("estante", e.target.value)} placeholder="Ej: Estante 3" />
            </div>
            <div className="field">
              <label className="label">Etiqueta</label>
              <input className="input" value={form.etiqueta || ""} onChange={(e) => campo("etiqueta", e.target.value)} placeholder="Ej: Suspensión Suzuki" />
            </div>
          </div>
          <div className="field-row">
            <div className="field">
              <label className="label">Unidad</label>
              <input className="input" value={form.unidad || ""} onChange={(e) => campo("unidad", e.target.value)} />
            </div>
            <div className="field">
              <label className="label">Stock</label>
              <input className="input mono" type="number" value={form.stock} onChange={(e) => campo("stock", e.target.value)} />
            </div>
            <div className="field">
              <label className="label">Stock mínimo</label>
              <input className="input mono" type="number" value={form.stock_minimo} onChange={(e) => campo("stock_minimo", e.target.value)} />
            </div>
          </div>
          <div className="field-row">
            <div className="field">
              <label className="label">Precio venta (sin factura)</label>
              <input className="input mono" type="number" step="0.01" value={form.precio_venta} onChange={(e) => campo("precio_venta", e.target.value)} required />
            </div>
            <div className="field">
              <label className="label">Precio facturado</label>
              <input className="input mono" type="number" step="0.01" value={form.precio_facturado} onChange={(e) => campo("precio_facturado", e.target.value)} required />
            </div>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onCancelar}>Cancelar</button>
            <button className="btn btn-primary" disabled={guardando}>{guardando ? "Guardando..." : "Guardar producto"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
