import { useState } from "react";
import { api } from "../../api.js";

export default function MiPassword({ onClose }) {
  const [actual, setActual] = useState("");
  const [nueva, setNueva] = useState("");
  const [repetir, setRepetir] = useState("");
  const [error, setError] = useState("");
  const [listo, setListo] = useState(false);

  async function guardar(e) {
    e.preventDefault();
    setError("");
    if (nueva !== repetir) { setError("Las contraseñas nuevas no coinciden"); return; }
    try {
      await api.cambiarMiPassword(actual, nueva);
      setListo(true);
    } catch (err) {
      setError(typeof err === "string" ? err : err?.message || "No se pudo cambiar");
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal-box" style={{ width: 400 }}>
        <h2>Cambiar mi contraseña</h2>
        {error && <div className="error-msg">{error}</div>}
        {listo ? (
          <>
            <div className="ok-msg">✓ Contraseña actualizada.</div>
            <div className="modal-actions"><button className="btn btn-primary" onClick={onClose}>Listo</button></div>
          </>
        ) : (
          <form onSubmit={guardar}>
            <div className="field"><label className="label">Contraseña actual</label><input className="input" type="password" value={actual} onChange={(e) => setActual(e.target.value)} required autoComplete="current-password" /></div>
            <div className="field"><label className="label">Nueva contraseña</label><input className="input" type="password" value={nueva} onChange={(e) => setNueva(e.target.value)} required autoComplete="new-password" /></div>
            <div className="field"><label className="label">Repite la nueva</label><input className="input" type="password" value={repetir} onChange={(e) => setRepetir(e.target.value)} required autoComplete="new-password" /></div>
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
              <button className="btn btn-primary">Cambiar</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
