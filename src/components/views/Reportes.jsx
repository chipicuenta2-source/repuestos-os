import { useEffect, useMemo, useState } from "react";
import { api } from "../../api.js";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import VistaPreviaPDF from "../modals/VistaPreviaPDF.jsx";
import { encabezadoPDF } from "../../marca.js";

export default function Reportes() {
  const [rentabilidad, setRentabilidad] = useState([]);
  const [resumen, setResumen] = useState(null);
  const [pdf, setPdf] = useState(null);

  useEffect(() => {
    api.listarRentabilidadProductos().then(setRentabilidad);
    api.resumenGeneral().then(setResumen);
  }, []);

  const ganadiaNetaTotal = useMemo(
    () => rentabilidad.reduce((acc, r) => acc + (r.ganancia_neta || 0), 0),
    [rentabilidad]
  );
  const sinCosto = useMemo(
    () => rentabilidad.filter((r) => r.cantidad_vendida > 0 && r.costo_promedio == null).length,
    [rentabilidad]
  );
  const masVendidos = useMemo(
    () => [...rentabilidad].sort((a, b) => b.cantidad_vendida - a.cantidad_vendida).slice(0, 5),
    [rentabilidad]
  );
  const menosVendidos = useMemo(
    () => [...rentabilidad].filter((r) => r.cantidad_vendida >= 0).sort((a, b) => a.cantidad_vendida - b.cantidad_vendida).slice(0, 5),
    [rentabilidad]
  );

  function exportarPDF() {
    const doc = new jsPDF();
    const y0 = encabezadoPDF(doc, "Reporte General");
    doc.text(`Generado: ${new Date().toLocaleString()}`, 14, y0);

    autoTable(doc, {
      startY: y0 + 6,
      head: [["Producto", "Categoría", "Stock", "Vendido", "Total vendido", "Costo prom.", "Ganancia neta", "Última compra"]],
      body: rentabilidad.map((r) => [
        r.nombre,
        r.categoria || "—",
        r.stock,
        r.cantidad_vendida,
        `Bs ${r.total_vendido.toFixed(2)}`,
        r.costo_promedio != null ? `Bs ${r.costo_promedio.toFixed(2)}` : "—",
        r.ganancia_neta != null ? `Bs ${r.ganancia_neta.toFixed(2)}` : "—",
        r.ultima_compra ? new Date(r.ultima_compra).toLocaleDateString() : "Sin compras registradas",
      ]),
      styles: { fontSize: 8 },
    });

    let y = doc.lastAutoTable.finalY + 10;
    if (resumen) {
      doc.setFontSize(12);
      doc.text("Resumen general del sistema", 14, y);
      doc.setFontSize(10);
      y += 7;
      doc.text(`Cobrado de créditos: Bs ${resumen.total_cobrado_creditos.toFixed(2)}`, 14, y);
      y += 6;
      doc.text(`Por cobrar a clientes: Bs ${resumen.total_por_cobrar.toFixed(2)}`, 14, y);
      y += 6;
      doc.text(`Por pagar a proveedores: Bs ${resumen.total_por_pagar.toFixed(2)}`, 14, y);
      y += 6;
      doc.text(`Balance: Bs ${resumen.balance.toFixed(2)}`, 14, y);
    }

    setPdf({ doc, nombre: "reporte-general.pdf" });
  }

  return (
    <div className="view-scroll">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h1 className="font-title" style={{ fontSize: 19, textTransform: "uppercase" }}>Reportes</h1>
        <button className="btn btn-primary" onClick={exportarPDF}>Ver PDF</button>
      </div>
      {pdf && <VistaPreviaPDF doc={pdf.doc} nombre={pdf.nombre} onClose={() => setPdf(null)} />}

      <div className="kpi-row">
        <div className="kpi-card">
          <div className="kpi-label">Ganancia neta real</div>
          <div className="kpi-value mono">Bs {ganadiaNetaTotal.toFixed(2)}</div>
          {sinCosto > 0 && (
            <div style={{ fontSize: 11, color: "var(--accent-orange-dark)", marginTop: 4 }}>
              {sinCosto} producto(s) vendidos sin costo de compra registrado
            </div>
          )}
        </div>
        {resumen && (
          <>
            <div className="kpi-card">
              <div className="kpi-label">Cobrado de créditos</div>
              <div className="kpi-value mono">Bs {resumen.total_cobrado_creditos.toFixed(2)}</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Por cobrar</div>
              <div className="kpi-value mono">Bs {resumen.total_por_cobrar.toFixed(2)}</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Por pagar</div>
              <div className="kpi-value mono">Bs {resumen.total_por_pagar.toFixed(2)}</div>
            </div>
          </>
        )}
      </div>

      <div className="field-row" style={{ marginBottom: 20 }}>
        <div className="card" style={{ flex: 1 }}>
          <h3 style={{ marginBottom: 10, fontSize: 14 }}>Más vendidos</h3>
          {masVendidos.map((r) => (
            <div key={r.producto_id} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid var(--border)", fontSize: 13 }}>
              <span>{r.nombre}</span><span className="mono">{r.cantidad_vendida} u.</span>
            </div>
          ))}
        </div>
        <div className="card" style={{ flex: 1 }}>
          <h3 style={{ marginBottom: 10, fontSize: 14 }}>Menos vendidos</h3>
          {menosVendidos.map((r) => (
            <div key={r.producto_id} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid var(--border)", fontSize: 13 }}>
              <span>{r.nombre}</span><span className="mono">{r.cantidad_vendida} u.</span>
            </div>
          ))}
        </div>
      </div>

      <h3 style={{ marginBottom: 10, fontSize: 14 }}>Rentabilidad e inventario por producto</h3>
      <div className="card" style={{ padding: 0, overflowX: "auto" }}>
        <table className="table">
          <thead>
            <tr><th>Producto</th><th>Categoría</th><th>Stock</th><th>Vendido</th><th>Total vendido</th><th>Costo prom.</th><th>Ganancia neta</th><th>Última compra</th></tr>
          </thead>
          <tbody>
            {rentabilidad.map((r) => (
              <tr key={r.producto_id}>
                <td>{r.nombre}</td>
                <td>{r.categoria || "—"}</td>
                <td className="mono">{r.stock}</td>
                <td className="mono">{r.cantidad_vendida}</td>
                <td className="mono">Bs {r.total_vendido.toFixed(2)}</td>
                <td className="mono">{r.costo_promedio != null ? `Bs ${r.costo_promedio.toFixed(2)}` : "—"}</td>
                <td className="mono">{r.ganancia_neta != null ? `Bs ${r.ganancia_neta.toFixed(2)}` : "—"}</td>
                <td>{r.ultima_compra ? new Date(r.ultima_compra).toLocaleDateString() : "Sin compras registradas"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
