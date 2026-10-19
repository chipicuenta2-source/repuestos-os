import ConfigRed from "../ConfigRed.jsx";

export default function ConfigRedModal({ onClose }) {
  return (
    <div className="modal-overlay">
      <div className="modal-box" style={{ width: 760, maxWidth: "94vw" }}>
        <h2>Configuración de red</h2>
        <ConfigRed />
        <div style={{ marginTop: 14 }}>
          <button className="btn btn-secondary" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}
