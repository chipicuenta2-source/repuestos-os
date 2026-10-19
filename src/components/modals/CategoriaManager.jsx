import { useState } from "react";
import { api } from "../../api.js";

export default function CategoriaManager({ categorias, onCambio, onClose }) {
  const [nombre, setNombre] = useState("");
  const [error, setError] = useState("");

  async function agregar(e) {
    e.preventDefault();
    if (!nombre.trim()) return;
    await api.crearCategoria(nombre.trim());
    setNombre("");
    onCambio();
  }

  async function eliminar(id) {
    setError("");
    try {
      await api.eliminarCategoria(id);
      onCambio();
    } catch (err) {
      setError(typeof err === "string" ? err : err?.message || "No se pudo eliminar");
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal-box">
        <h2>Categorías</h2>
        {error && <div className="error-msg">{error}</div>}
        <form onSubmit={agregar} style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <input className="input" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nueva categoría" />
          <button className="btn btn-primary btn-sm">Agregar</button>
        </form>
        <table className="table">
          <tbody>
            {categorias.map((c) => (
              <tr key={c.id}>
                <td>{c.nombre}</td>
                <td style={{ textAlign: "right" }}>
                  <button className="btn btn-danger btn-sm" onClick={() => eliminar(c.id)}>Eliminar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}
