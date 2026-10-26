pub mod caja;
pub mod productos;
pub mod proveedores;
pub mod reportes;
pub mod usuarios;
pub mod ventas;

use usuarios::UsuarioPublico;

/// Contexto de cada llamada: quién la hace (si hay sesión iniciada).
#[derive(Clone, Default)]
pub struct Ctx {
    pub usuario: Option<UsuarioPublico>,
}

impl Ctx {
    pub fn usuario(&self) -> Result<&UsuarioPublico, String> {
        self.usuario.as_ref().ok_or_else(|| "SESION_EXPIRADA".to_string())
    }
    pub fn es_admin(&self) -> bool {
        self.usuario.as_ref().map(|u| u.rol == "admin").unwrap_or(false)
    }
}
