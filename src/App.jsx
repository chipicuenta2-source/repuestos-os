import { useCallback, useEffect, useState } from "react";
import { api } from "./api.js";
import ActivacionLicencia from "./components/ActivacionLicencia.jsx";
import Login from "./components/Login.jsx";
import AbrirCaja from "./components/AbrirCaja.jsx";
import Sidebar from "./components/Sidebar.jsx";
import CerrarCaja from "./components/modals/CerrarCaja.jsx";
import MiPassword from "./components/modals/MiPassword.jsx";
import ConfigRedModal from "./components/modals/ConfigRedModal.jsx";
import POS from "./components/views/POS.jsx";
import Productos from "./components/views/Productos.jsx";
import Proveedores from "./components/views/Proveedores.jsx";
import Deudas from "./components/views/Deudas.jsx";
import Reportes from "./components/views/Reportes.jsx";
import Usuarios from "./components/views/Usuarios.jsx";
import Movimientos from "./components/views/Movimientos.jsx";
import Ventas from "./components/views/Ventas.jsx";
import Historial from "./components/views/Historial.jsx";
import Red from "./components/views/Red.jsx";

const errTxt = (e) => (typeof e === "string" ? e : e?.message || "Error desconocido");

export default function App() {
  const [config, setConfig] = useState(null);
  const [estadoLicencia, setEstadoLicencia] = useState(null);
  const [errorInicio, setErrorInicio] = useState("");
  const [usuario, setUsuario] = useState(null);
  const [cajaSesion, setCajaSesion] = useState(null);
  const [cajaCargada, setCajaCargada] = useState(false);
  const [vista, setVista] = useState("pos");
  const [mostrarCerrarCaja, setMostrarCerrarCaja] = useState(false);
  const [mostrarRed, setMostrarRed] = useState(false);
  const [mostrarPass, setMostrarPass] = useState(false);
  const [aviso, setAviso] = useState("");

  const iniciar = useCallback(async () => {
    setErrorInicio("");
    try {
      setConfig(await api.obtenerConfig());
      setEstadoLicencia(await api.validarLicencia());
    } catch (e) {
      setErrorInicio(errTxt(e));
    }
  }, []);

  useEffect(() => { iniciar(); }, [iniciar]);

  const limpiarSesion = useCallback(() => {
    setUsuario(null);
    setCajaSesion(null);
    setCajaCargada(false);
    setMostrarCerrarCaja(false);
    setVista("pos");
  }, []);

  useEffect(() => {
    const h = () => {
      limpiarSesion();
      setAviso("Tu sesión terminó (o tu usuario cambió). Vuelve a iniciar sesión.");
    };
    window.addEventListener("sesion-expirada", h);
    return () => window.removeEventListener("sesion-expirada", h);
  }, [limpiarSesion]);

  // Tras iniciar sesión, ver si este usuario ya tiene una caja abierta
  useEffect(() => {
    if (!usuario) return;
    let vivo = true;
    api.obtenerCajaAbierta()
      .then((c) => { if (vivo) { setCajaSesion(c || null); setCajaCargada(true); } })
      .catch(() => { if (vivo) setCajaCargada(true); });
    return () => { vivo = false; };
  }, [usuario]);

  async function salir() {
    try { await api.logout(); } catch { /* ignorar */ }
    setAviso("");
    limpiarSesion();
  }

  if (errorInicio) {
    return (
      <div className="centered-screen">
        <div className="login-box" style={{ textAlign: "center" }}>
          <div className="brand" style={{ justifyContent: "center" }}>Sin conexión</div>
          <div className="error-msg">{errorInicio}</div>
          <button className="btn btn-primary" onClick={iniciar}>Reintentar</button>
          <button className="link-btn" onClick={() => setMostrarRed(true)}>⚙ Configuración de red</button>
        </div>
        {mostrarRed && <ConfigRedModal onClose={() => setMostrarRed(false)} />}
      </div>
    );
  }

  if (!estadoLicencia || !config) return null;

  const redModal = mostrarRed && <ConfigRedModal onClose={() => setMostrarRed(false)} />;

  if (!estadoLicencia.valida) {
    return (
      <div className="centered-screen">
        <div className="login-box" style={{ textAlign: "center" }}>
          <div className="brand" style={{ justifyContent: "center" }}>⚠️ Equipo no autorizado</div>
          <p style={{ color: "var(--text-muted)", fontSize: 13.5 }}>
            Esta instalación no corresponde al equipo que activó la licencia. Contacta al proveedor del sistema.
          </p>
          <button className="link-btn" onClick={() => setMostrarRed(true)}>⚙ Configuración de red</button>
        </div>
        {redModal}
      </div>
    );
  }

  if (!estadoLicencia.activada) {
    if (config.modo === "cliente") {
      return (
        <div className="centered-screen">
          <div className="login-box" style={{ textAlign: "center" }}>
            <div className="brand" style={{ justifyContent: "center" }}>Servidor sin activar</div>
            <p style={{ color: "var(--text-muted)", fontSize: 13.5 }}>
              El sistema aún no está activado en la PC servidor. Actívalo allí con la clave de licencia y luego reintenta.
            </p>
            <button className="btn btn-primary" onClick={iniciar}>Reintentar</button>
            <button className="link-btn" onClick={() => setMostrarRed(true)}>⚙ Configuración de red</button>
          </div>
          {redModal}
        </div>
      );
    }
    return (
      <>
        <ActivacionLicencia estado={estadoLicencia} onActivada={setEstadoLicencia} onConfigRed={() => setMostrarRed(true)} />
        {redModal}
      </>
    );
  }

  if (!usuario) {
    return (
      <>
        <Login onLogin={(u) => { setAviso(""); setUsuario(u); }} onConfigRed={() => setMostrarRed(true)} aviso={aviso} />
        {redModal}
      </>
    );
  }

  if (!cajaCargada) return null;

  if (!cajaSesion) {
    return <AbrirCaja usuario={usuario} onAbierta={setCajaSesion} />;
  }

  const vistas = {
    pos: POS, ventas: Ventas, movimientos: Movimientos, inventario: Productos, proveedores: Proveedores,
    deudas: Deudas, reportes: Reportes, usuarios: Usuarios, historial: Historial, red: Red,
  };
  const soloAdmin = ["inventario", "proveedores", "deudas", "reportes", "usuarios", "historial", "red"];
  const vistaOk = soloAdmin.includes(vista) && usuario.rol !== "admin" ? "pos" : vista;
  const VistaActual = vistas[vistaOk] || POS;

  return (
    <div className="app-shell">
      <Sidebar vista={vistaOk} setVista={setVista} usuario={usuario} cajaSesion={cajaSesion} />
      <div className="main">
        <div className="topbar">
          <h1>{tituloVista(vistaOk, usuario)}</h1>
          <div className="user-chip">
            {config.modo !== "independiente" && (
              <span className="badge-red-net">{config.modo === "servidor" ? "Servidor" : "Cliente"}</span>
            )}
            <div className="avatar">{usuario.nombre.slice(0, 2).toUpperCase()}</div>
            {usuario.nombre} · {usuario.rol === "admin" ? "Admin" : "Cajero"}
            <button className="btn-logout" onClick={() => setMostrarPass(true)}>Contraseña</button>
            <button className="btn-logout" onClick={() => setMostrarCerrarCaja(true)}>Cerrar caja</button>
            <button className="btn-logout" onClick={salir}>Salir</button>
          </div>
        </div>
        <div className="content">
          <VistaActual usuario={usuario} cajaSesion={cajaSesion} />
        </div>
      </div>

      {mostrarPass && <MiPassword onClose={() => setMostrarPass(false)} />}

      {mostrarCerrarCaja && (
        <CerrarCaja
          cajaSesion={cajaSesion}
          onCancelar={() => setMostrarCerrarCaja(false)}
          onCerrada={salir}
        />
      )}
    </div>
  );
}

function tituloVista(vista, usuario) {
  const titulos = {
    pos: "Punto de Venta",
    ventas: usuario.rol === "admin" ? "Ventas" : "Mis ventas",
    movimientos: "Otros ingresos y egresos",
    inventario: "Inventario",
    proveedores: "Proveedores",
    deudas: "Clientes / Deudas",
    reportes: "Reportes",
    usuarios: "Usuarios",
    historial: "Historial de actividad",
    red: "Red y equipos",
  };
  return titulos[vista] || "";
}
