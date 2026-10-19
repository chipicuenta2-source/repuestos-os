import ConfigRed from "../ConfigRed.jsx";

export default function Red() {
  return (
    <div className="view-scroll">
      <h1 className="font-title" style={{ fontSize: 19, textTransform: "uppercase", marginBottom: 6 }}>Red y equipos</h1>
      <p style={{ fontSize: 12.5, color: "var(--text-muted)", marginBottom: 16 }}>
        Conecta varias computadoras del local para trabajar con los mismos datos. Cada persona entra con su usuario y queda registrado en el historial.
      </p>
      <div className="card" style={{ padding: 20 }}>
        <ConfigRed />
      </div>
    </div>
  );
}
