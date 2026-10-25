import { MARCA } from "../marca.js";
import { useState } from "react";
import { api } from "../api.js";

export default function ActivacionLicencia({ estado, onActivada, onConfigRed }) {
  const [clave, setClave] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);
  const [copiado, setCopiado] = useState(false);

  const copiarCodigo = async () => {
    try {
      await navigator.clipboard.writeText(estado.codigo_equipo);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1500);
    } catch {
      // portapapeles no disponible, no es crítico
    }
  };

  const activar = async (e) => {
    e.preventDefault();
    setError("");
    setCargando(true);
    try {
      const nuevoEstado = await api.activarLicencia(clave.trim());
      onActivada(nuevoEstado);
    } catch (err) {
      setError(typeof err === "string" ? err : err?.message || "No se pudo activar la licencia");
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="centered-screen">
      <div className="login-box">
        <div className="brand-logo"><img src={MARCA.logo} alt={MARCA.nombre} /></div>

        <div className="codigo-equipo">
          <div style={{ fontSize: 11, opacity: 0.75, textTransform: "uppercase" }}>Código de este equipo</div>
          <div className="valor mono">{estado.codigo_equipo}</div>
          <button type="button" className="btn btn-secondary btn-sm" onClick={copiarCodigo} style={{ marginTop: 6 }}>
            {copiado ? "✓ Copiado" : "Copiar código"}
          </button>
        </div>

        <p style={{ fontSize: 12.5, color: "var(--text-muted)", marginBottom: 16 }}>
          Envía este código al proveedor del sistema para recibir tu clave de activación.
        </p>

        {error && <div className="error-msg">{error}</div>}

        <form onSubmit={activar}>
          <div className="field">
            <label className="label">Clave de activación</label>
            <input
              className="input mono"
              placeholder="REPUESTOS-XXXXXXXXXXXX-XXXXXXXX"
              value={clave}
              onChange={(e) => setClave(e.target.value)}
              required
            />
          </div>
          <button className="btn btn-primary" style={{ width: "100%", justifyContent: "center" }} disabled={cargando}>
            {cargando ? "Activando..." : "Activar"}
          </button>
        </form>
        {onConfigRed && (
          <button type="button" className="link-btn" onClick={onConfigRed}>⚙ Configuración de red</button>
        )}
      </div>
    </div>
  );
}
