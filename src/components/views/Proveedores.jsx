import { useEffect, useState } from "react";
import { api } from "../../api.js";
import NuevaCompra from "../modals/NuevaCompra.jsx";
import HistorialProveedor from "../modals/HistorialProveedor.jsx";

export default function Proveedores() {
  const [proveedores, setProveedores] = useState([]);
  const [productos, setProductos] = useState([]);
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [nuevaCategoria, setNuevaCategoria] = useState("");
  const [comprandoA, setComprandoA] = useState(null);
  const [verHistorial, setVerHistorial] = useState(null);

  useEffect(() => { cargar(); }, []);
  function cargar() {
    api.listarProveedores().then(setProveedores);
    api.listarProductos().then(setProductos);
  }

  async function crear(e) {
    e.preventDefault();
    if (!nuevoNombre.trim()) return;
    await api.crearProveedor({ nombre: nuevoNombre.trim(), categoria: nuevaCategoria || null, telefono: "" });
    setNuevoNombre("");
    setNuevaCategoria("");
    cargar();
  }

  return (
    <div className="view-scroll">
      <h1 className="font-title" style={{ fontSize: 19, textTransform: "uppercase", marginBottom: 16 }}>Proveedores</h1>

      <div className="card" style={{ marginBottom: 18 }}>
        <form onSubmit={crear} className="field-row" style={{ alignItems: "flex-end" }}>
          <div className="field">
            <label className="label">Nombre del proveedor</label>
            <input className="input" value={nuevoNombre} onChange={(e) => setNuevoNombre(e.target.value)} />
          </div>
          <div className="field">
            <label className="label">Rubro / categoría</label>
            <input className="input" value={nuevaCategoria} onChange={(e) => setNuevaCategoria(e.target.value)} placeholder="Ej: Suspensión" />
          </div>
          <button className="btn btn-primary" style={{ marginBottom: 14 }}>+ Agregar proveedor</button>
        </form>
      </div>

      <div className="card" style={{ padding: 0, overflowX: "auto" }}>
        <table className="table">
          <thead><tr><th>Proveedor</th><th>Rubro</th><th>Saldo</th><th></th></tr></thead>
          <tbody>
            {proveedores.map((p) => (
              <tr key={p.id}>
                <td style={{ fontWeight: 700 }}>{p.nombre}</td>
                <td>{p.categoria || "—"}</td>
                <td className="mono" style={{ color: p.saldo > 0 ? "var(--accent-orange-dark)" : "var(--green-ok)" }}>
                  Bs {p.saldo.toFixed(2)}
                </td>
                <td style={{ whiteSpace: "nowrap" }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => setComprandoA(p)}>+ Compra</button>{" "}
                  <button className="btn btn-secondary btn-sm" onClick={() => setVerHistorial(p)}>Ver cuenta</button>
                </td>
              </tr>
            ))}
            {proveedores.length === 0 && <tr><td colSpan={4} style={{ textAlign: "center", color: "var(--text-muted)" }}>Sin proveedores</td></tr>}
          </tbody>
        </table>
      </div>

      {comprandoA && (
        <NuevaCompra
          proveedor={comprandoA}
          productos={productos}
          onGuardada={() => { setComprandoA(null); cargar(); }}
          onCancelar={() => setComprandoA(null)}
        />
      )}
      {verHistorial && (
        <HistorialProveedor proveedor={verHistorial} onClose={() => { setVerHistorial(null); cargar(); }} />
      )}
    </div>
  );
}
