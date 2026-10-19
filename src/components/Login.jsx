import { useState } from "react";
import { api } from "../api.js";

export default function Login({ onLogin, onConfigRed, aviso }) {
  const [usuario, setUsuario] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  const entrar = async (e) => {
    e.preventDefault();
    setError("");
    setCargando(true);
    try {
      const u = await api.login(usuario.trim(), password);
      onLogin(u);
    } catch (err) {
      setError(typeof err === "string" ? err : err?.message || "No se pudo iniciar sesión");
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="centered-screen">
      <div className="login-box">
        <div className="brand"><span className="brand-dot"></span>REPUESTOS OS</div>
        {aviso && <div className="error-msg">{aviso}</div>}
        {error && <div className="error-msg">{error}</div>}
        <form onSubmit={entrar}>
          <div className="field">
            <label className="label">Usuario</label>
            <input className="input" value={usuario} onChange={(e) => setUsuario(e.target.value)} autoFocus required />
          </div>
          <div className="field">
            <label className="label">Contraseña</label>
            <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <button className="btn btn-primary" style={{ width: "100%", justifyContent: "center" }} disabled={cargando}>
            {cargando ? "Ingresando..." : "Ingresar"}
          </button>
        </form>
        <p style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 16, textAlign: "center" }}>
          admin / admin123 (usuario por defecto)
        </p>
        {onConfigRed && (
          <button type="button" className="link-btn" onClick={onConfigRed}>⚙ Configuración de red</button>
        )}
      </div>
    </div>
  );
}
