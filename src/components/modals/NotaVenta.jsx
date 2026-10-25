import { useState } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import VistaPreviaPDF from "./VistaPreviaPDF.jsx";
import { encabezadoPDF } from "../../marca.js";

export default function NotaVenta({ venta, onClose }) {
  const [pdf, setPdf] = useState(null);

  function exportarPDF() {
    const doc = new jsPDF();
    const y0 = encabezadoPDF(doc, `Nota de Venta #${venta.id}`);
    doc.text(`Fecha: ${new Date(venta.fecha).toLocaleString()}`, 14, y0);
    doc.text(`Tipo: ${venta.es_facturado ? "Con factura" : "Sin factura"}`, 14, y0 + 6);
    doc.text(`Método de pago: ${venta.metodo_pago}`, 14, y0 + 12);
    if (venta.cliente_nombre) doc.text(`Cliente: ${venta.cliente_nombre}`, 14, y0 + 18);

    autoTable(doc, {
      startY: y0 + 24,
      head: [["Producto", "Código", "Cant.", "P. Unit.", "Subtotal"]],
      body: venta.items.map((i) => [
        i.nombre,
        i.oem || i.codigo || "",
        i.cantidad,
        `Bs ${i.precio_unitario.toFixed(2)}`,
        `Bs ${(i.precio_unitario * i.cantidad).toFixed(2)}`,
      ]),
    });

    const finalY = doc.lastAutoTable.finalY || 60;
    doc.setFontSize(12);
    doc.text(`Total: Bs ${venta.monto_total.toFixed(2)}`, 14, finalY + 10);

    setPdf({ doc, nombre: `nota-venta-${venta.id}.pdf` });
  }

  return (
    <div className="modal-overlay">
      <div className="modal-box">
        <h2>Nota de venta #{venta.id}</h2>
        <table className="table">
          <thead>
            <tr><th>Producto</th><th>Cant.</th><th>P. Unit.</th><th>Subtotal</th></tr>
          </thead>
          <tbody>
            {venta.items.map((i) => (
              <tr key={i.id}>
                <td>{i.nombre}</td>
                <td className="mono">{i.cantidad}</td>
                <td className="mono">Bs {i.precio_unitario.toFixed(2)}</td>
                <td className="mono">Bs {(i.precio_unitario * i.cantidad).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ textAlign: "right", marginTop: 12, fontWeight: 700 }}>
          Total: <span className="mono">Bs {venta.monto_total.toFixed(2)}</span>
        </div>
        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>Cerrar</button>
          <button className="btn btn-primary" onClick={exportarPDF}>Ver PDF</button>
        </div>
      </div>
      {pdf && <VistaPreviaPDF doc={pdf.doc} nombre={pdf.nombre} onClose={() => setPdf(null)} />}
    </div>
  );
}
