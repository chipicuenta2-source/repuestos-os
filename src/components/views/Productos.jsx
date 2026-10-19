import { useEffect, useState } from "react";
import { api } from "../../api.js";
import ProductoForm from "../modals/ProductoForm.jsx";
import CategoriaManager from "../modals/CategoriaManager.jsx";

export default function Productos() {
  const [productos, setProductos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [busqueda, setBusqueda] = useState("");
  const [editando, setEditando] = useState(null); // null = cerrado, {} = nuevo, {...} = editar
  const [mostrarCategorias, setMostrarCategorias] = useState(false);

  useEffect(() => { cargar(); }, []);

  function cargar() {
    api.listarProductos().then(setProductos);
    api.listarCategorias().then(setCategorias);
  }

  const filtrados = productos.filter((p) => {
    const t = busqueda.toLowerCase();
    return (
      p.nombre.toLowerCase().includes(t) ||
      (p.codigo || "").toLowerCase().includes(t) ||
      (p.oem || "").toLowerCase().includes(t) ||
      (p.estante || "").toLowerCase().includes(t) ||
      (p.etiqueta || "").toLowerCase().includes(t)
    );
  });

  async function eliminar(id) {
    if (!confirm("¿Dar de baja este producto?")) return;
    await api.eliminarProducto(id);
    cargar();
  }

  return (
    <div className="view-scroll">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h1 className="font-title" style={{ fontSize: 19, textTransform: "uppercase" }}>Inventario</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-secondary" onClick={() => setMostrarCategorias(true)}>Categorías</button>
          <button className="btn btn-primary" onClick={() => setEditando({})}>+ Nuevo producto</button>
        </div>
      </div>

      <div className="filters-row">
        <div className="search-box" style={{ flex: 1 }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
          <input placeholder="Buscar por nombre, código, OEM, estante o etiqueta..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflowX: "auto" }}>
        <table className="table">
          <thead>
            <tr>
              <th>Producto</th><th>Código / OEM</th><th>Categoría</th><th>Estante</th><th>Etiqueta</th>
              <th>Stock</th><th>P. Venta</th><th>P. Facturado</th><th></th>
            </tr>
          </thead>
          <tbody>
            {filtrados.map((p) => (
              <tr key={p.id} className={p.stock <= p.stock_minimo ? "low-stock-row" : ""}>
                <td>
                  <div style={{ fontWeight: 700 }}>{p.nombre}</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{p.marca} {p.procedencia ? `· ${p.procedencia}` : ""}</div>
                </td>
                <td className="mono">{p.oem || p.codigo || "—"}</td>
                <td>{p.categoria_nombre || "—"}</td>
                <td>{p.estante || "—"}</td>
                <td>{p.etiqueta || "—"}</td>
                <td className="mono">{p.stock}</td>
                <td className="mono">Bs {p.precio_venta.toFixed(2)}</td>
                <td className="mono">Bs {p.precio_facturado.toFixed(2)}</td>
                <td style={{ whiteSpace: "nowrap" }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => setEditando(p)}>Editar</button>{" "}
                  <button className="btn btn-danger btn-sm" onClick={() => eliminar(p.id)}>Baja</button>
                </td>
              </tr>
            ))}
            {filtrados.length === 0 && (
              <tr><td colSpan={9} style={{ textAlign: "center", color: "var(--text-muted)" }}>Sin productos</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {editando !== null && (
        <ProductoForm
          productoExistente={editando.id ? editando : null}
          categorias={categorias}
          onGuardado={() => { setEditando(null); cargar(); }}
          onCancelar={() => setEditando(null)}
        />
      )}

      {mostrarCategorias && (
        <CategoriaManager
          categorias={categorias}
          onCambio={() => { api.listarCategorias().then(setCategorias); }}
          onClose={() => setMostrarCategorias(false)}
        />
      )}
    </div>
  );
}
