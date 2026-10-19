// Configuración de red de este equipo, guardada en config.json junto a la base de datos.
//   independiente : como siempre, un solo equipo (valor por defecto, no cambia nada para instalaciones existentes)
//   servidor      : este equipo guarda los datos y atiende a las demás PCs de la red local
//   cliente       : este equipo no guarda datos; trabaja contra la PC servidor

use serde::{Deserialize, Serialize};
use std::net::UdpSocket;
use std::path::Path;

pub const PUERTO_DEFECTO: u16 = 7878;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Config {
    pub modo: String,
    pub puerto: u16,
    pub servidor_url: String,
}

impl Default for Config {
    fn default() -> Self {
        Config { modo: "independiente".into(), puerto: PUERTO_DEFECTO, servidor_url: String::new() }
    }
}

pub fn cargar(dir: &Path) -> Config {
    std::fs::read_to_string(dir.join("config.json"))
        .ok()
        .and_then(|s| serde_json::from_str::<Config>(&s).ok())
        .filter(|c| matches!(c.modo.as_str(), "independiente" | "servidor" | "cliente"))
        .unwrap_or_default()
}

pub fn guardar(dir: &Path, c: &Config) -> Result<(), String> {
    let _ = std::fs::create_dir_all(dir);
    let texto = serde_json::to_string_pretty(c).map_err(|e| e.to_string())?;
    std::fs::write(dir.join("config.json"), texto).map_err(|e| format!("No se pudo guardar la configuración: {}", e))
}

/// Acepta "192.168.1.10", "192.168.1.10:7878" o "http://192.168.1.10:7878" y devuelve "http://host:puerto".
pub fn normalizar_url(entrada: &str) -> Result<String, String> {
    let mut s = entrada.trim().trim_end_matches('/').to_string();
    if s.is_empty() {
        return Err("Escribe la dirección de la PC servidor (por ejemplo 192.168.1.10)".into());
    }
    if let Some(r) = s.strip_prefix("http://") {
        s = r.to_string();
    } else if s.starts_with("https://") {
        return Err("La red local usa http://, no https://".into());
    }
    if s.contains('/') || s.contains(' ') {
        return Err("La dirección no es válida".into());
    }
    if !s.contains(':') {
        s = format!("{}:{}", s, PUERTO_DEFECTO);
    }
    let puerto = s.rsplit(':').next().unwrap_or("");
    if puerto.parse::<u16>().is_err() {
        return Err("El puerto de la dirección no es válido".into());
    }
    Ok(format!("http://{}", s))
}

pub fn validar(c: &Config) -> Result<Config, String> {
    let mut c = c.clone();
    if !matches!(c.modo.as_str(), "independiente" | "servidor" | "cliente") {
        return Err("Modo de red inválido".into());
    }
    if c.puerto < 1024 {
        return Err("El puerto debe estar entre 1024 y 65535".into());
    }
    if c.modo == "cliente" {
        c.servidor_url = normalizar_url(&c.servidor_url)?;
    }
    Ok(c)
}

/// Direcciones IP de este equipo en la red (para decirle al usuario qué escribir en las otras PCs).
pub fn ips_locales() -> Vec<String> {
    let mut ips: Vec<String> = Vec::new();
    // "Conectar" un socket UDP no envía nada: solo hace que el sistema elija la interfaz de salida.
    for destino in ["8.8.8.8:80", "192.168.0.1:80", "192.168.1.1:80", "10.0.0.1:80", "172.16.0.1:80"] {
        if let Ok(sock) = UdpSocket::bind("0.0.0.0:0") {
            if sock.connect(destino).is_ok() {
                if let Ok(addr) = sock.local_addr() {
                    let ip = addr.ip();
                    if !ip.is_loopback() && !ip.is_unspecified() {
                        let t = ip.to_string();
                        if !ips.contains(&t) {
                            ips.push(t);
                        }
                    }
                }
            }
        }
    }
    ips
}
