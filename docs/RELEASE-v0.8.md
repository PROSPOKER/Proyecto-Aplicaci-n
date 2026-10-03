# Habita v0.8

Revisión: 3 de octubre de 2026. Código de aplicación: `a406e5c195279741e0e723545e3ae87ac125e1b5`.

Esta versión continúa el piloto. Mantiene su guardado `habita-pilot-v2`, perfil, foto, horarios, registros y separación real/ensayo.

- Cielos artísticos que siguen la hora real en seis periodos del día, con nubes, sol, luna y estrellas.
- Editor de personaje por capas, conjuntos guardados y tres trajes originales opcionales de Italian brainrot.
- Tienda, inventario y monedas ficticias; compras explícitas, sin cargos duplicados ni cambios de ropa por doble toque.
- Casa editable con mover, girar, almacenar, deshacer y cancelar; validación de recorridos antes de guardar.
- Proyectos con consecuencias visibles, recuerdos persistentes y vecinos con rutinas y conversaciones autónomas.
- Corrección coherente de registros, teclado, audio opcional y movimiento reducido.

Validación local: **54/54 escenarios aprobados**, incluidos los 30 de regresión del piloto, el recorrido completo y 15 minutos simulados de observación en Chromium. Resultados y límites: [QA-LIFE.md](QA-LIFE.md) y [QA-LIFE-UX.md](QA-LIFE-UX.md).

## Estado de publicación

| Paso | Estado comprobado |
| --- | --- |
| Código subido | `a406e5c` se subió a `main`; `git ls-remote` confirmó ese mismo SHA en el repositorio remoto. |
| Despliegue de GitHub Pages terminado | Sin confirmar. El acceso a la API del último build está bloqueado desde este entorno. |
| Versión pública comprobada | Sin confirmar. La conexión al dominio de Pages falla en el proxy con `CONNECT tunnel failed, response 403`; esto no prueba un error del sitio. |

Enlace para abrir la aplicación: https://prospoker.github.io/Proyecto-Aplicaci-n/?v=0.8

La actualización se identifica por **v0.8 · una vida contigo**. El parámetro del enlace ayuda a solicitar una copia nueva del HTML; conserva el mismo origen y los datos locales existentes.

La autonomía usa reglas, memoria y planificación local. No implica conciencia subjetiva. Los avisos funcionan mientras Habita está abierta; al regresar se reconstruye un resumen acotado, sin simular ejecución continua ni penalizar ausencias. La foto sigue siendo una referencia personal. Los estados ficticios no miden salud y las fuentes científicas mantienen sus límites dentro de la aplicación.
