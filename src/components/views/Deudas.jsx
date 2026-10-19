import { useEffect, useState } from "react";
import { api } from "../../api.js";
import PagoVenta from "../modals/PagoVenta.jsx";
import HistorialProveedor from "../modals/HistorialProveedor.jsx";

export default function Deudas() {
  const [tab, setTab] = useState("clientes");
  const [deudasClientes, setDeudasClientes] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [busqueda, setBusqueda] = useState("");
  const [pagando, setPagando] = useState(null);
  const [verHistorial, setVerHistorial] = useState(null);

  useEffect(() => { cargar(); }, [tab]);
  function cargar() {
    if (tab === "clientes") api.listarDeudasClientes("").then(setDeudasClientes);
    else api.listarProveedores().then(setProveedores);
  }

  useEffect(() => {
    if (tab !== "clientes") return;
    const t = setTimeout(() => api.listarDeudasClientes(busqueda).then(setDeudasClientes), 200);
    return () => clearTimeout(t);
  }, [busqueda, tab]);

  const proveedoresConDeuda = proveedores.filter((p) => p.saldo > 0);

  return (
    <div className="view-scroll">
      <h1 className="font-title" style={{ fontSize: 19, textTransform: "uppercase", marginBottom: 16 }}>Clientes / Deudas</h1>

      <div className="tabs">
        <button className={`tab-btn ${tab === "clientes" ? "active" : ""}`} onClick={() => setTab("clientes")}>Cuentas por Cobrar</button>
        <button className={`tab-btn ${tab === "proveedores" ? "active" : ""}`} onClick={() => setTab("proveedores")}>Cuentas por Pagar</button>
      </div>

      {tab === "clientes" ? (
        <>
          <div className="search-box" style={{ marginBottom: 16, maxWidth: 400 }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
            <input placeholder="Buscar cliente..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
          </div>
          <div className="card" style={{ padding: 0, overflowX: "auto" }}>
            <table className="table">
              <thead><tr><th>Cliente</th><th>Fecha</th><th>Total</th><th>Abonado</th><th>Saldo</th><th></th></tr></thead>
              <tbody>
                {deudasClientes.map((d) => (
                  <tr key={d.venta_id}>
                    <td style={{ fontWeight: 700 }}>{d.cliente_nombre}</td>
                    <td>{new Date(d.fecha).toLocaleDateString()}</td>
                    <td className="mono">Bs {d.monto_total.toFixed(2)}</td>
                    <td className="mono">Bs {d.monto_abonado.toFixed(2)}</td>
                    <td className="mono" style={{ color: "var(--accent-orange-dark)", fontWeight: 700 }}>Bs {d.saldo.toFixed(2)}</td>
                    <td><button className="btn btn-primary btn-sm" onClick={() => setPagando(d)}>Registrar abono</button></td>
                  </tr>
                ))}
                {deudasClientes.length === 0 && <tr><td colSpan={6} style={{ textAlign: "center", color: "var(--text-muted)" }}>Sin deudas pendientes</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div className="card" style={{ padding: 0, overflowX: "auto" }}>
          <table className="table">
            <thead><tr><th>Proveedor</th><th>Rubro</th><th>Saldo</th><th></th></tr></thead>
            <tbody>
              {proveedoresConDeuda.map((p) => (
                <tr key={p.id}>
                  <td style={{ fontWeight: 700 }}>{p.nombre}</td>
                  <td>{p.categoria || "—"}</td>
                  <td className="mono" style={{ color: "var(--accent-orange-dark)", fontWeight: 700 }}>Bs {p.saldo.toFixed(2)}</td>
                  <td><button className="btn btn-primary btn-sm" onClick={() => setVerHistorial(p)}>Ver / pagar</button></td>
                </tr>
              ))}
              {proveedoresConDeuda.length === 0 && <tr><td colSpan={4} style={{ textAlign: "center", color: "var(--text-muted)" }}>Sin deudas pendientes</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {pagando && <PagoVenta deuda={pagando} onGuardado={() => { setPagando(null); cargar(); }} onCancelar={() => setPagando(null)} />}
      {verHistorial && <HistorialProveedor proveedor={verHistorial} onClose={() => { setVerHistorial(null); cargar(); }} />}
    </div>
  );
}
