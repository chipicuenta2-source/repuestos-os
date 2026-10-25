import logo from "./assets/logo.jpg";

export const MARCA = {
  nombre: "RyN Importadora",
  lema: "La Solución en Repuestos para Vehículos",
  direccion: "Av. 20 de Diciembre y Antofagasta",
  contactos: ["65712718", "57961832", "64970622"],
  logo,
};
export const CONTACTOS_TXT = MARCA.contactos.join(" - ");

// Encabezado común de los PDF: devuelve la posición Y donde puede seguir el contenido.
export function encabezadoPDF(doc, titulo) {
  doc.setFontSize(16);
  doc.text(MARCA.nombre.toUpperCase(), 14, 14);
  doc.setFontSize(8.5);
  doc.text(`${MARCA.direccion}  ·  Cel: ${CONTACTOS_TXT}`, 14, 19);
  doc.setFontSize(12);
  doc.text(titulo, 14, 27);
  doc.setFontSize(10);
  return 33;
}
