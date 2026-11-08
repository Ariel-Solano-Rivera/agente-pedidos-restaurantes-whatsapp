# Ejecución local

1. Copiar `.env.example` a `.env` y reemplazar solo valores locales de demostración.
2. Ejecutar `docker compose up --build`.
3. Abrir `http://localhost:5173`.
4. Usuarios ficticios iniciales: `admin@marazul.test`, `caja@marazul.test`, `cocina@marazul.test`; contraseña: `password`. `admin@sierraverde.test` permite verificar el aislamiento entre dos restaurantes ficticios. Cambiar estas credenciales antes de cualquier uso que no sea la demostración local.

La base de datos usa un volumen Docker. Para reiniciar solamente datos ficticios: `docker compose down -v`; esto borra el volumen del proyecto.
