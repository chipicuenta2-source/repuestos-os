// Despachador central: recibe el nombre de un comando y sus argumentos en JSON, verifica la sesión
// y el rol, y ejecuta la función correspondiente. Lo usan igual la app local y el servidor de red,
// así las reglas de permisos viven en un solo lugar y no se pueden saltar desde un cliente.

use crate::audit;
use crate::commands::{self, usuarios, Ctx};
use crate::licencia;
use rusqlite::Connection;
use serde::de::DeserializeOwned;
use serde_json::{json, Value};

pub const VERSION: &str = env!("CARGO_PKG_VERSION");

/// Comandos que se pueden usar sin haber iniciado sesión.
fn es_publico(cmd: &str) -> bool {
    matches!(cmd, "login" | "validar_licencia" | "activar_licencia" | "ping")
}

/// Comandos reservados al administrador.
fn requiere_admin(cmd: &str) -> bool {
    matches!(
        cmd,
        "crear_producto"
            | "actualizar_producto"
            | "eliminar_producto"
            | "crear_categoria"
            | "eliminar_categoria"
            | "listar_proveedores"
            | "crear_proveedor"
            | "registrar_compra"
            | "registrar_pago_proveedor"
            | "listar_movimientos_proveedor"
            | "listar_deudas_clientes"
            | "registrar_pago_venta"
            | "listar_pagos_venta"
            | "listar_usuarios"
            | "crear_usuario"
            | "cambiar_estado_usuario"
            | "editar_usuario"
            | "eliminar_movimiento_caja"
            | "listar_rentabilidad_productos"
            | "resumen_general"
            | "listar_auditoria"
    )
}

fn arg<T: DeserializeOwned>(args: &Value, clave: &str) -> Result<T, String> {
    serde_json::from_value(args.get(clave).cloned().unwrap_or(Value::Null))
        .map_err(|e| format!("Dato inválido en '{}': {}", clave, e))
}

fn json_de<T: serde::Serialize>(v: T) -> Result<Value, String> {
    serde_json::to_value(v).map_err(|e| e.to_string())
}

pub fn despachar(conn: &mut Connection, ctx: &Ctx, cmd: &str, args: &Value) -> Result<Value, String> {
    // Sesión: se vuelve a leer al usuario para que desactivarlo o cambiarle el rol surta efecto al instante
    let mut ctx = ctx.clone();
    if !es_publico(cmd) {
        let u = ctx.usuario.as_ref().ok_or_else(|| "SESION_EXPIRADA".to_string())?;
        let vigente = usuarios::vigente(conn, u).ok_or_else(|| "SESION_EXPIRADA".to_string())?;
        if requiere_admin(cmd) && vigente.rol != "admin" {
            return Err("No tienes permiso para esta acción".into());
        }
        ctx.usuario = Some(vigente);
    }

    match cmd {
        "ping" => json_de(json!({ "app": "REPUESTOS OS", "version": VERSION })),

        // --- Licencia ---
        "validar_licencia" => json_de(licencia::validar(conn)),
        "activar_licencia" => {
            let clave: String = arg(args, "clave")?;
            let r = licencia::activar(conn, clave);
            if r.is_ok() {
                audit::registrar(conn, None, "activar_licencia", "licencia", None, "Licencia activada en este equipo");
            }
            json_de(r?)
        }

        // --- Sesión ---
        "login" => {
            let usuario: String = arg(args, "usuario")?;
            let password: String = arg(args, "password")?;
            json_de(usuarios::login(conn, &usuario, &password)?)
        }

        // --- Caja ---
        "obtener_caja_abierta" => json_de(commands::ventas::obtener_caja_abierta(conn, &ctx)?),
        "abrir_caja" => json_de(commands::ventas::abrir_caja(conn, &ctx, arg(args, "montoApertura")?)?),
        "cerrar_caja" => json_de(commands::ventas::cerrar_caja(
            conn,
            &ctx,
            arg(args, "cajaSesionId")?,
            arg(args, "montoContado")?,
        )?),

        // --- Productos y categorías ---
        "listar_productos" => json_de(commands::productos::listar_productos(conn)?),
        "buscar_productos" => {
            let texto: String = arg(args, "texto")?;
            json_de(commands::productos::buscar_productos(conn, &texto)?)
        }
        "crear_producto" => json_de(commands::productos::crear_producto(conn, &ctx, arg(args, "producto")?)?),
        "actualizar_producto" => {
            commands::productos::actualizar_producto(conn, &ctx, arg(args, "id")?, arg(args, "producto")?)?;
            Ok(Value::Null)
        }
        "eliminar_producto" => {
            commands::productos::eliminar_producto(conn, &ctx, arg(args, "id")?)?;
            Ok(Value::Null)
        }
        "listar_categorias" => json_de(commands::productos::listar_categorias(conn)?),
        "crear_categoria" => {
            let nombre: String = arg(args, "nombre")?;
            json_de(commands::productos::crear_categoria(conn, &ctx, &nombre)?)
        }
        "eliminar_categoria" => {
            commands::productos::eliminar_categoria(conn, &ctx, arg(args, "id")?)?;
            Ok(Value::Null)
        }

        // --- Proveedores ---
        "listar_proveedores" => json_de(commands::proveedores::listar_proveedores(conn)?),
        "crear_proveedor" => json_de(commands::proveedores::crear_proveedor(conn, &ctx, arg(args, "proveedor")?)?),
        "registrar_compra" => json_de(commands::proveedores::registrar_compra(conn, &ctx, arg(args, "compra")?)?),
        "registrar_pago_proveedor" => {
            commands::proveedores::registrar_pago_proveedor(conn, &ctx, arg(args, "proveedorId")?, arg(args, "monto")?)?;
            Ok(Value::Null)
        }
        "listar_movimientos_proveedor" => {
            json_de(commands::proveedores::listar_movimientos_proveedor(conn, arg(args, "proveedorId")?)?)
        }

        // --- Clientes y ventas ---
        "listar_clientes" => json_de(commands::ventas::listar_clientes(conn)?),
        "crear_cliente" => json_de(commands::ventas::crear_cliente(conn, &ctx, arg(args, "cliente")?)?),
        "registrar_venta" => json_de(commands::ventas::registrar_venta(conn, &ctx, arg(args, "venta")?)?),
        "listar_ventas" => {
            let filtros = commands::ventas::FiltroVentas {
                caja_sesion_id: arg(args, "cajaSesionId")?,
                usuario_id: arg(args, "usuarioId")?,
                desde: arg(args, "desde")?,
                hasta: arg(args, "hasta")?,
            };
            json_de(commands::ventas::listar_ventas(conn, &ctx, filtros)?)
        }
        "listar_items_venta" => json_de(commands::ventas::listar_items_venta(conn, &ctx, arg(args, "ventaId")?)?),
        "listar_deudas_clientes" => {
            let busqueda: Option<String> = arg(args, "busqueda")?;
            json_de(commands::ventas::listar_deudas_clientes(conn, &busqueda.unwrap_or_default())?)
        }
        "registrar_pago_venta" => {
            commands::ventas::registrar_pago_venta(conn, &ctx, arg(args, "ventaId")?, arg(args, "monto")?)?;
            Ok(Value::Null)
        }
        "listar_pagos_venta" => json_de(commands::ventas::listar_pagos_venta(conn, arg(args, "ventaId")?)?),

        // --- Otros ingresos y egresos de caja ---
        "registrar_movimiento_caja" => json_de(commands::caja::registrar_movimiento(conn, &ctx, arg(args, "movimiento")?)?),
        "listar_movimientos_caja" => {
            let f = commands::caja::FiltroMovimientos {
                desde: arg(args, "desde")?,
                hasta: arg(args, "hasta")?,
                tipo: arg(args, "tipo")?,
            };
            json_de(commands::caja::listar_movimientos(conn, &ctx, f)?)
        }
        "eliminar_movimiento_caja" => {
            commands::caja::eliminar_movimiento(conn, &ctx, arg(args, "id")?)?;
            Ok(Value::Null)
        }

        // --- Usuarios ---
        "listar_usuarios" => json_de(usuarios::listar_usuarios(conn)?),
        "crear_usuario" => json_de(usuarios::crear_usuario(conn, &ctx, arg(args, "usuario")?)?),
        "editar_usuario" => {
            usuarios::editar_usuario(conn, &ctx, arg(args, "id")?, arg(args, "datos")?)?;
            Ok(Value::Null)
        }
        "cambiar_mi_password" => {
            usuarios::cambiar_mi_password(conn, &ctx, &arg::<String>(args, "actual")?, &arg::<String>(args, "nueva")?)?;
            Ok(Value::Null)
        }
        "cambiar_estado_usuario" => {
            usuarios::cambiar_estado_usuario(conn, &ctx, arg(args, "id")?, arg(args, "activo")?)?;
            Ok(Value::Null)
        }

        // --- Reportes y auditoría ---
        "listar_rentabilidad_productos" => json_de(commands::reportes::listar_rentabilidad_productos(conn)?),
        "resumen_general" => json_de(commands::reportes::resumen_general(conn)?),
        "listar_auditoria" => {
            let filtros: Option<audit::FiltroAuditoria> = arg(args, "filtros")?;
            json_de(audit::listar(conn, filtros.unwrap_or_default())?)
        }

        otro => Err(format!("Comando desconocido: {}", otro)),
    }
}
