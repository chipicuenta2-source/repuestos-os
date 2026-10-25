import { useEffect, useMemo, useState } from "react";

// Muestra el PDF antes de descargarlo. `doc` es un objeto jsPDF ya armado.
export default function VistaPreviaPDF({ doc, nombre, onClose }) {
  const [descargado, setDescargado] = useState(false);
  const url = useMemo(() => URL.createObjectURL(doc.output("blob")), [doc]);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);

  function descargar() {
    doc.save(nombre);
    setDescargado(true);
  }

  return (
    <div className="modal-overlay" style={{ zIndex: 60 }}>
      <div className="modal-box" style={{ width: "min(900px, 94vw)", maxWidth: "94vw", height: "92vh", display: "flex", flexDirection: "column" }}>
        <h2>Vista previa · {nombre}</h2>
        {descargado && <div className="ok-msg">✓ PDF descargado. Revisa la carpeta de Descargas de tu equipo.</div>}
        <iframe title="Vista previa del PDF" src={url} style={{ flex: 1, width: "100%", border: "1px solid var(--border)", borderRadius: 8, background: "#fff" }} />
        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>Cerrar</button>
          <button className="btn btn-primary" onClick={descargar}>Descargar PDF</button>
        </div>
      </div>
    </div>
  );
}
