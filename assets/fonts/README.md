# Fuente del exportador

Lora, fuente variable de los autores de Lora/Cyreal, descargada del repositorio
oficial Google Fonts el 14 de octubre de 2026.

- Fuente: https://github.com/google/fonts/tree/main/ofl/lora
- Archivo original: `Lora[wght].ttf`, conservado aquí como `Lora.ttf`.
- Licencia: SIL Open Font License 1.1, incluida en `OFL.txt`.

El exportador de tarjetas carga este archivo directamente con Sharp/Pango para
no depender de las fuentes instaladas en el servidor. `next.config.ts` incluye
el archivo en el bundle de la función `/api/share-images`.
