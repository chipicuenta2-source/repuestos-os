import { MARCA, CONTACTOS_TXT } from "../marca.js";
const ICONS = {
  pos: <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />,
};

const ITEMS = [
  { key: "pos", label: "Punto de Venta", roles: ["admin", "cajero"] },
  { key: "ventas", label: usuario => usuario.rol === "admin" ? "Ventas" : "Mis ventas", roles: ["admin", "cajero"] },
  { key: "movimientos", label: "Ingresos / Egresos", roles: ["admin", "cajero"] },
  { key: "inventario", label: "Inventario", roles: ["admin"] },
  { key: "proveedores", label: "Proveedores", roles: ["admin"] },
  { key: "deudas", label: "Clientes / Deudas", roles: ["admin"] },
  { key: "reportes", label: "Reportes", roles: ["admin"] },
  { key: "usuarios", label: "Usuarios", roles: ["admin"] },
  { key: "historial", label: "Historial", roles: ["admin"] },
  { key: "red", label: "Red", roles: ["admin"] },
];

const SVGS = {
  ventas: "M9 11l3 3L22 4 M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11",
  movimientos: "M12 1v22 M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6",
  historial: "M12 22a10 10 0 100-20 10 10 0 000 20z M12 6v6l4 2",
  red: "M5 12.55a11 11 0 0 1 14.08 0 M1.42 9a16 16 0 0 1 21.16 0 M8.53 16.11a6 6 0 0 1 6.95 0 M12 20h.01",
  pos: "M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6 M9 21a1 1 0 100-2 1 1 0 000 2 M20 21a1 1 0 100-2 1 1 0 000 2",
  inventario: "M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z M3.27 6.96 12 12.01 20.73 6.96 M12 22.08V12",
  proveedores: "M1 4v6h6 M3.51 15a9 9 0 1 0 2.13-9.36L1 10",
  deudas: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M9 7a4 4 0 100-8 4 4 0 000 8 M23 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 010 7.75",
  reportes: "M12 20V10 M18 20V4 M6 20v-4",
  usuarios: "M12 15a3 3 0 100-6 3 3 0 000 6z M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z",
};

export default function Sidebar({ vista, setVista, usuario, cajaSesion }) {
  const items = ITEMS.filter((i) => i.roles.includes(usuario.rol));
  return (
    <div className="sidebar">
      <div className="brand-side"><img src={MARCA.logo} alt={MARCA.nombre} /></div>
      {items.map((item) => (
        <button
          key={item.key}
          className={`nav-item ${vista === item.key ? "active" : ""}`}
          onClick={() => setVista(item.key)}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d={SVGS[item.key]} />
          </svg>
          {typeof item.label === "function" ? item.label(usuario) : item.label}
        </button>
      ))}
      <div className="sidebar-footer">
        Caja #{cajaSesion?.id} · apertura Bs {cajaSesion?.monto_apertura?.toFixed(2)}
        <br />
        {usuario.nombre} ({usuario.usuario})
        <div style={{ marginTop: 8, opacity: 0.7, fontSize: 10.5, lineHeight: 1.4 }}>{MARCA.direccion}<br />Cel: {CONTACTOS_TXT}</div>
      </div>
    </div>
  );
}
