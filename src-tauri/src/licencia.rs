use chrono::{Duration, Local};
use hmac::{Hmac, Mac};
use rusqlite::{params, Connection};
use serde::Serialize;
use sha2::{Digest, Sha256};

// IMPORTANTE: esta frase debe ser idéntica a la usada en herramientas/generar-clave.mjs.
// Cámbiala por una propia antes de repartir el sistema de verdad.
const SECRET: &str = "cambia-esta-frase-secreta-antes-de-repartir-repuestos-os-2026";
const PREFIJO: &str = "REPUESTOS";
const MAX_INTENTOS: i64 = 5;
const HORAS_BLOQUEO: i64 = 24;

#[derive(Serialize, Clone)]
pub struct EstadoLicencia {
    pub valida: bool,
    pub activada: bool,
    pub hardware_id: String,
    pub codigo_equipo: String,
    pub mensaje: Option<String>,
}

pub fn calcular_hardware_id() -> String {
    let uid = machine_uid::get().unwrap_or_else(|_| "equipo-desconocido".to_string());
    let mut hasher = Sha256::new();
    hasher.update(uid.as_bytes());
    hex::encode(hasher.finalize())
}

pub fn calcular_codigo_equipo() -> String {
    let hash = calcular_hardware_id();
    let base: String = hash.chars().take(12).collect::<String>().to_uppercase();
    format!("{}-{}-{}", &base[0..4], &base[4..8], &base[8..12])
}

fn checksum(codigo_normalizado: &str) -> String {
    let mut mac = Hmac::<Sha256>::new_from_slice(SECRET.as_bytes()).expect("clave HMAC inválida");
    mac.update(codigo_normalizado.as_bytes());
    let resultado = mac.finalize().into_bytes();
    hex::encode(&resultado[0..4])
}

pub fn validar_clave_para_este_equipo(clave: &str) -> bool {
    let partes: Vec<&str> = clave.trim().split('-').collect();
    if partes.len() != 3 {
        return false;
    }
    let (prefijo, codigo_clave, check) = (partes[0], partes[1], partes[2]);
    if prefijo.to_uppercase() != PREFIJO {
        return false;
    }
    let codigo_equipo_actual = calcular_codigo_equipo().replace('-', "");
    if codigo_clave.to_uppercase() != codigo_equipo_actual {
        return false;
    }
    checksum(&codigo_equipo_actual).to_lowercase() == check.to_lowercase()
}

pub fn asegurar_registro(conn: &Connection) {
    let hay_registro: i64 = conn
        .query_row("SELECT COUNT(*) FROM licencia WHERE id = 1", [], |r| r.get(0))
        .unwrap_or(0);
    if hay_registro == 0 {
        let hardware_id = calcular_hardware_id();
        let fecha = Local::now().to_rfc3339();
        let _ = conn.execute(
            "INSERT INTO licencia (id, hardware_id, clave_activacion, fecha_activacion, intentos_fallidos, bloqueado_hasta)
             VALUES (1, ?1, NULL, ?2, 0, NULL)",
            params![hardware_id, fecha],
        );
    }
}

pub fn validar(conn: &Connection) -> EstadoLicencia {
    let hardware_actual = calcular_hardware_id();
    let codigo_equipo = calcular_codigo_equipo();

    let fila: Option<(String, Option<String>)> = conn
        .query_row(
            "SELECT hardware_id, clave_activacion FROM licencia WHERE id = 1",
            [],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .ok();

    match fila {
        Some((hardware_guardado, clave_activacion)) => {
            let valida = hardware_guardado == hardware_actual;
            let activada = clave_activacion.is_some();
            EstadoLicencia {
                valida,
                activada,
                hardware_id: hardware_actual,
                codigo_equipo,
                mensaje: None,
            }
        }
        None => EstadoLicencia {
            valida: true,
            activada: false,
            hardware_id: hardware_actual,
            codigo_equipo,
            mensaje: None,
        },
    }
}

pub fn activar(conn: &Connection, clave: String) -> Result<EstadoLicencia, String> {
    let (intentos_fallidos, bloqueado_hasta): (i64, Option<String>) = conn
        .query_row(
            "SELECT intentos_fallidos, bloqueado_hasta FROM licencia WHERE id = 1",
            [],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .map_err(|e| e.to_string())?;

    if let Some(bloqueo_str) = &bloqueado_hasta {
        if let Ok(bloqueo) = chrono::DateTime::parse_from_rfc3339(bloqueo_str) {
            let ahora = Local::now();
            if ahora.with_timezone(bloqueo.offset()) < bloqueo {
                let restantes = bloqueo.signed_duration_since(ahora.with_timezone(bloqueo.offset()));
                let horas = restantes.num_hours().max(0);
                let minutos = (restantes.num_minutes() % 60).max(0);
                return Err(format!(
                    "Demasiados intentos fallidos. Intenta de nuevo en {}h {}min.",
                    horas, minutos
                ));
            }
        }
    }

    if validar_clave_para_este_equipo(&clave) {
        let fecha = Local::now().to_rfc3339();
        conn.execute(
            "UPDATE licencia SET clave_activacion = ?1, fecha_activacion = ?2, intentos_fallidos = 0, bloqueado_hasta = NULL WHERE id = 1",
            params![clave, fecha],
        ).map_err(|e| e.to_string())?;
        let mut estado = validar(conn);
        estado.mensaje = Some("Licencia activada correctamente".into());
        Ok(estado)
    } else {
        let nuevos_intentos = intentos_fallidos + 1;
        if nuevos_intentos >= MAX_INTENTOS {
            let bloqueo_hasta = (Local::now() + Duration::hours(HORAS_BLOQUEO)).to_rfc3339();
            conn.execute(
                "UPDATE licencia SET intentos_fallidos = 0, bloqueado_hasta = ?1 WHERE id = 1",
                params![bloqueo_hasta],
            ).map_err(|e| e.to_string())?;
            Err(format!(
                "Clave inválida. Se alcanzó el máximo de {} intentos: este equipo queda bloqueado por {} horas.",
                MAX_INTENTOS, HORAS_BLOQUEO
            ))
        } else {
            conn.execute(
                "UPDATE licencia SET intentos_fallidos = ?1 WHERE id = 1",
                params![nuevos_intentos],
            ).map_err(|e| e.to_string())?;
            Err(format!(
                "Clave inválida para este equipo. Intento {} de {}.",
                nuevos_intentos, MAX_INTENTOS
            ))
        }
    }
}
