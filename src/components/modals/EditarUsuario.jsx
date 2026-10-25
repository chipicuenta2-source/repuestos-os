import { useState } from "react";
import { api } from "../../api.js";

export default function EditarUsuario({ usuario, esYo, onGuardado, onClose }) {
  const [form, setForm] = useState({ nombre: usuario.nombre, usuario: usuario.usuario, rol: usuario.rol, password: "" });
  const [error, setError] = useState("");
  const [ocupado, setOcupado] = useState(false);

  async function guardar(e) {
    e.preventDefault();
    setError("");
    setOcupado(true);
    try {
      await api.editarUsuario(usuario.id, { ...form, password: form.password.trim() || null });
      onGuardado();
    } catch (err) {
      setError(typeof err === "string" ? err : err?.message || "No se pudo guardar");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal-box" style={{ width: 420 }}>
        <h2>Editar usuario</h2>
        {error && <div className="error-msg">{error}</div>}
        <form onSubmit={guardar}>
          <div className="field"><label className="label">Nombre</label><input className="input" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required /></div>
          <div className="field"><label className="label">Usuario</label><input className="input" value={form.usuario} onChange={(e) => setForm({ ...form, usuario: e.target.value })} required /></div>
          <div className="field">
            <label className="label">Rol</label>
            <select className="input" value={form.rol} onChange={(e) => setForm({ ...form, rol: e.target.value })} disabled={esYo}>
              <option value="cajero">Cajero</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div className="field">
            <label className="label">Nueva contraseña</label>
            <input className="input" type="password" placeholder="Déjala vacía para no cambiarla" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} autoComplete="new-password" />
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
            <button className="btn btn-primary" disabled={ocupado}>{ocupado ? "Guardando..." : "Guardar"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
