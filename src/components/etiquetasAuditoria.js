// Nombres legibles y colores para cada acción que registra la auditoría.
export const ACCIONES = {
  login: { texto: "Inicio de sesión", clase: "act-info" },
  login_fallido: { texto: "Intento fallido", clase: "act-bad" },
  logout: { texto: "Cierre de sesión", clase: "act-info" },
  abrir_caja: { texto: "Apertura de caja", clase: "act-ok" },
  cerrar_caja: { texto: "Cierre de caja", clase: "act-ok" },
  venta: { texto: "Venta", clase: "act-venta" },
  crear_producto: { texto: "Producto nuevo", clase: "act-warn" },
  editar_producto: { texto: "Producto editado", clase: "act-warn" },
  baja_producto: { texto: "Producto dado de baja", clase: "act-bad" },
  crear_categoria: { texto: "Categoría nueva", clase: "act-warn" },
  eliminar_categoria: { texto: "Categoría eliminada", clase: "act-bad" },
  crear_proveedor: { texto: "Proveedor nuevo", clase: "act-info" },
  compra: { texto: "Compra a proveedor", clase: "act-info" },
  pago_proveedor: { texto: "Pago a proveedor", clase: "act-info" },
  crear_cliente: { texto: "Cliente nuevo", clase: "act-info" },
  abono_cliente: { texto: "Abono de cliente", clase: "act-ok" },
  crear_usuario: { texto: "Usuario nuevo", clase: "act-warn" },
  cambiar_estado_usuario: { texto: "Usuario activado/desactivado", clase: "act-warn" },
  activar_licencia: { texto: "Licencia activada", clase: "act-ok" },
  config_red: { texto: "Configuración de red", clase: "act-warn" },
};

export function etiquetaAccion(accion) {
  return ACCIONES[accion] || { texto: accion, clase: "act-info" };
}

export function fechaHora(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("es-BO") + " " + d.toLocaleTimeString("es-BO", { hour: "2-digit", minute: "2-digit" });
}

// YYYY-MM-DD en hora local (no UTC), para los filtros por fecha
export function fechaIso(d = new Date()) {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${dia}`;
}

export function hace(dias) {
  const d = new Date();
  d.setDate(d.getDate() - dias);
  return fechaIso(d);
}
