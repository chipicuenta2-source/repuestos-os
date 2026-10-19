import { useEffect, useState } from "react";
import { api } from "../api.js";

const MODOS = [
  { k: "independiente", t: "Independiente", d: "Un solo equipo, con su propia base de datos. Como funcionaba hasta ahora." },
  { k: "servidor", t: "Servidor", d: "Este equipo guarda los datos y atiende a las demás computadoras de la red." },
  { k: "cliente", t: "Cliente", d: "Este equipo se conecta al servidor. Usa los mismos usuarios, productos y ventas." },
];

export default function ConfigRed() {
  const [cfg, setCfg] = useState(null);
  const [modo, setModo] = useState("independiente");
  const [puerto, setPuerto] = useState("7878");
  const [url, setUrl] = useState("");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    api.obtenerConfig().then((c) => {
      setCfg(c);
      setModo(c.modo);
      setPuerto(String(c.puerto));
      setUrl(c.servidor_url || "");
    });
  }, []);

  if (!cfg) return null;
  const errTxt = (e) => (typeof e === "string" ? e : e?.message || "Error");

  async function probar() {
    setError(""); setMsg(""); setOcupado(true);
    try {
      await api.probarConexion(url);
      setMsg("✓ Conexión correcta: el servidor responde.");
    } catch (e) { setError(errTxt(e)); } finally { setOcupado(false); }
  }

  async function guardar() {
    setError(""); setMsg(""); setOcupado(true);
    try {
      await api.guardarConfig({ modo, puerto: parseInt(puerto, 10) || 7878, servidorUrl: url });
      setMsg("Guardado. Reiniciando la aplicación...");
      setTimeout(() => api.reiniciarApp(), 700);
    } catch (e) { setError(errTxt(e)); } finally { setOcupado(false); }
  }

  return (
    <div>
      {error && <div className="error-msg">{error}</div>}
      {msg && <div className="ok-msg">{msg}</div>}
      <div className="modo-cards">
        {MODOS.map((m) => (
          <button key={m.k} type="button" className={`modo-card ${modo === m.k ? "sel" : ""}`} onClick={() => setModo(m.k)}>
            <h3 className="font-title">{m.t}</h3>
            <p>{m.d}</p>
          </button>
        ))}
      </div>

      {modo === "servidor" && (
        <>
          <div className="field" style={{ maxWidth: 160 }}>
            <label className="label">Puerto</label>
            <input className="input mono" value={puerto} onChange={(e) => setPuerto(e.target.value.replace(/\D/g, ""))} />
          </div>
          <div className="ip-box">
            <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 4 }}>En las otras PCs escribe como dirección del servidor:</div>
            {(cfg.ips.length ? cfg.ips : ["(sin red detectada)"]).map((ip) => (
              <div key={ip} className="mono">{ip}:{puerto || 7878}</div>
            ))}
          </div>
          {cfg.modo === "servidor" && (
            <p style={{ fontSize: 12.5, marginBottom: 8 }}>
              Estado: {cfg.error_servidor ? <b style={{ color: "var(--red-danger)" }}>{cfg.error_servidor}</b> : <b style={{ color: "var(--green-ok)" }}>activo</b>} · Sesiones conectadas: {cfg.sesiones_activas}
            </p>
          )}
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>
            Esta PC debe estar encendida mientras las demás trabajan. Si Windows pregunta por el firewall, permite el acceso en redes privadas. En Mac, acepta el permiso de red local.
          </p>
        </>
      )}

      {modo === "cliente" && (
        <div className="field" style={{ maxWidth: 380 }}>
          <label className="label">Dirección del servidor</label>
          <input className="input mono" placeholder="192.168.1.10" value={url} onChange={(e) => setUrl(e.target.value)} />
          <button type="button" className="btn btn-secondary btn-sm" style={{ marginTop: 8 }} onClick={probar} disabled={ocupado || !url.trim()}>
            Probar conexión
          </button>
        </div>
      )}

      <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "10px 0 14px" }}>Al cambiar de modo la aplicación se reiniciará.</p>
      <button className="btn btn-primary" onClick={guardar} disabled={ocupado || (modo === "cliente" && !url.trim())}>
        Guardar y reiniciar
      </button>
    </div>
  );
}
