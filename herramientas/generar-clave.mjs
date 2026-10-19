#!/usr/bin/env node
// Genera claves de activación atadas a un equipo específico.
// Uso: node herramientas/generar-clave.mjs <codigo-de-equipo> "Nombre de quien la recibe"
//
// IMPORTANTE: este SECRET debe ser IDÉNTICO al de src-tauri/src/licencia.rs.
// Cámbialo por uno propio (frase larga y aleatoria) antes de repartir el sistema de verdad,
// y actualízalo en ambos archivos a la vez.

import crypto from "node:crypto";

const SECRET = "cambia-esta-frase-secreta-antes-de-repartir-repuestos-os-2026";
const PREFIJO = "REPUESTOS";

function normalizar(codigo) {
  return codigo.replace(/[\s-]/g, "").toUpperCase();
}

function main() {
  const [, , codigoEquipoRaw, nombre] = process.argv;

  if (!codigoEquipoRaw) {
    console.log(`
Uso:
  node herramientas/generar-clave.mjs <codigo-de-equipo> "Nombre de quien la recibe"

Ejemplo:
  node herramientas/generar-clave.mjs 3F2A-9B10-C4EE "Taller Hermanos Quispe"

El código de equipo te lo pasa el cliente desde la pantalla de activación de su instalación.
`);
    process.exit(1);
  }

  const codigo = normalizar(codigoEquipoRaw);
  if (codigo.length !== 12) {
    console.error(`Error: el código de equipo debe tener 12 caracteres (tiene ${codigo.length}): "${codigo}"`);
    process.exit(1);
  }

  const checksum = crypto
    .createHmac("sha256", SECRET)
    .update(codigo)
    .digest("hex")
    .slice(0, 8);

  const clave = `${PREFIJO}-${codigo}-${checksum}`;

  console.log("\n=== Clave de activación generada ===");
  if (nombre) console.log(`Para: ${nombre}`);
  console.log(`Código de equipo: ${codigo}`);
  console.log(`Clave: ${clave}\n`);
}

main();
