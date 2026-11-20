# DC Soporte

Centro de control privado del dueño de DC Gestión Jurídica para administrar y dar soporte a los despachos de la app comercial.

- Web liviana (HTML, CSS y JavaScript), sin instalar nada. Modo oscuro, claro y automático.
- Todos los datos los entrega el servidor solo a la cuenta de plataforma (funciones `dcsoporte_*` con `app.exigir_plataforma()`).
- La sesión vive en `sessionStorage`: se cierra al cerrar el navegador y tras 15 minutos sin uso.
- Íconos: Phosphor (licencia MIT).
