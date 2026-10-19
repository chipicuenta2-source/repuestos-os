import { useState } from "react";
import { api } from "../api.js";

export default function AbrirCaja({ usuario, onAbierta }) {
  const [monto, setMonto] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");

  const abrir = async (e) => {
    e.preventDefault();
    setError("");
    setCargando(true);
    try {
      const sesion = await api.abrirCaja(parseFloat(monto || "0"));
      onAbierta(sesion);
    } catch (err) {
      setError(typeof err === "string" ? err : err?.message || "No se pudo abrir la caja");
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="centered-screen">
      <div className="login-box">
        <div className="brand"><span className="brand-dot"></span>Apertura de Caja</div>
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16 }}>
          Hola {usuario.nombre}, indica el monto con el que abres la caja hoy.
        </p>
        {error && <div className="error-msg">{error}</div>}
        <form onSubmit={abrir}>
          <div className="field">
            <label className="label">Monto de apertura (Bs)</label>
            <input
              className="input mono"
              type="number"
              step="0.01"
              min="0"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              autoFocus
              required
            />
          </div>
          <button className="btn btn-primary" style={{ width: "100%", justifyContent: "center" }} disabled={cargando}>
            {cargando ? "Abriendo..." : "Abrir caja"}
          </button>
        </form>
      </div>
    </div>
  );
}
