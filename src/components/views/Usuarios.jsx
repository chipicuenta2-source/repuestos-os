import { useEffect, useState } from "react";
import { api } from "../../api.js";
import EditarUsuario from "../modals/EditarUsuario.jsx";

export default function Usuarios({ usuario: yo }) {
  const [usuarios, setUsuarios] = useState([]);
  const [form, setForm] = useState({ nombre: "", usuario: "", password: "", rol: "cajero" });
  const [error, setError] = useState("");
  const [editando, setEditando] = useState(null);

  useEffect(() => { cargar(); }, []);
  function cargar() {
    api.listarUsuarios().then(setUsuarios);
  }

  async function crear(e) {
    e.preventDefault();
    setError("");
    try {
      await api.crearUsuario(form);
      setForm({ nombre: "", usuario: "", password: "", rol: "cajero" });
      cargar();
    } catch (err) {
      setError(typeof err === "string" ? err : err?.message || "No se pudo crear el usuario");
    }
  }

  async function cambiarEstado(u) {
    setError("");
    try {
      await api.cambiarEstadoUsuario(u.id, !u.activo);
      cargar();
    } catch (err) {
      setError(typeof err === "string" ? err : err?.message || "No se pudo cambiar el estado");
    }
  }

  return (
    <div className="view-scroll">
      <h1 className="font-title" style={{ fontSize: 19, textTransform: "uppercase", marginBottom: 16 }}>Usuarios</h1>

      <div className="card" style={{ marginBottom: 18 }}>
        {error && <div className="error-msg">{error}</div>}
        <form onSubmit={crear} className="field-row" style={{ alignItems: "flex-end", flexWrap: "wrap" }}>
          <div className="field"><label className="label">Nombre</label><input className="input" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required /></div>
          <div className="field"><label className="label">Usuario</label><input className="input" value={form.usuario} onChange={(e) => setForm({ ...form, usuario: e.target.value })} required /></div>
          <div className="field"><label className="label">Contraseña</label><input className="input" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required /></div>
          <div className="field">
            <label className="label">Rol</label>
            <select className="input" value={form.rol} onChange={(e) => setForm({ ...form, rol: e.target.value })}>
              <option value="cajero">Cajero</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <button className="btn btn-primary" style={{ marginBottom: 14 }}>+ Crear usuario</button>
        </form>
      </div>

      <div className="card" style={{ padding: 0, overflowX: "auto" }}>
        <table className="table">
          <thead><tr><th>Nombre</th><th>Usuario</th><th>Rol</th><th>Estado</th><th></th></tr></thead>
          <tbody>
            {usuarios.map((u) => (
              <tr key={u.id}>
                <td>{u.nombre}</td>
                <td className="mono">{u.usuario}</td>
                <td>{u.rol === "admin" ? "Admin" : "Cajero"}</td>
                <td><span className={`badge ${u.activo ? "badge-green" : "badge-red"}`}>{u.activo ? "Activo" : "Inactivo"}</span></td>
                <td style={{ whiteSpace: "nowrap" }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => setEditando(u)}>Editar</button>{" "}
                  <button className="btn btn-secondary btn-sm" onClick={() => cambiarEstado(u)}>{u.activo ? "Desactivar" : "Activar"}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editando && (
        <EditarUsuario
          usuario={editando}
          esYo={editando.id === yo?.id}
          onGuardado={() => { setEditando(null); cargar(); }}
          onClose={() => setEditando(null)}
        />
      )}
    </div>
  );
}
