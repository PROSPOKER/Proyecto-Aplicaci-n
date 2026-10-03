# Habita

Habita v0.8: tus pequeños pasos de autocuidado dejan huellas en una vida cotidiana que puedes observar y personalizar. Configura objetivos y horarios, realiza una propuesta a tu ritmo y confirma «Ya lo hice». Tu personaje responde con una acción relacionada, desarrolla proyectos y recuerda encuentros en un barrio inspirado en Viña del Mar.

Sitio: https://prospoker.github.io/Proyecto-Aplicaci-n/

Aplicación estática, sin compilación. GitHub Pages publica `main` desde la raíz; `.nojekyll` permite servir los archivos directamente. La versión aparece en la interfaz. Un commit subido no confirma que Pages haya terminado su despliegue.

Estado de esta entrega y comprobaciones de publicación: [docs/RELEASE-v0.8.md](docs/RELEASE-v0.8.md).

## Organización

| Archivo | Responsabilidad |
| --- | --- |
| `index.html` | Estructura y estilos de la interfaz original |
| `domain.js` | Estado inicial, acciones, decisiones, consecuencias y fecha coherente |
| `world.js` | Rutas por personaje, colisiones, reservas de objetos, entrada manual, cámara y eventos |
| `care.js` | Objetivos, horarios, evidencia y configuración de la casa |
| `ambience.js` | Escenas compactas, ilustración, animaciones y cielos artísticos en seis franjas del día |
| `appearance.js`, `wardrobe.js` | Personaje por capas, vista previa, conjuntos guardados y editor reversible |
| `home-layout.js`, `room-editor.js` | Distribución validada de muebles, giro, almacenamiento, deshacer y borradores |
| `simulation.js` | Necesidades ficticias, proyectos, recuerdos, vecinos y regreso tras ausencias |
| `economy.js`, `market.js` | Catálogo configurable, moneda ficticia, compras, inventario y vista previa |
| `companion.js` | Planificación de tareas, temporizador, avisos y audio opcional |
| `app.js` | Integración, persistencia validada y controles del piloto |
| `world-style.css` | Presentación de los nuevos escenarios y ajustes móviles |

Se conserva `habita-pilot-v2`, el perfil, la foto, los registros y la separación real/ensayo. Los nuevos campos son opcionales para copias anteriores. Un guardado incompatible se conserva sin sobrescribir y puede exportarse para revisarlo. El barrio original sigue en «Mis lugares anteriores».

## Desarrollo y verificación

Para desarrollo, sirve la carpeta con `python3 -m http.server 8877`. No requiere instalar nada para usar la versión pública en navegador.

Las pruebas de aceptación usan Node, Playwright y Chromium: `HABITA_TEST_URL=http://127.0.0.1:8877 node tests/browser.cjs`, `node tests/life-browser.cjs` y `node tests/life-ux.cjs`. `CHROMIUM_PATH` cambia el ejecutable y `HABITA_TEST_GROUP` limita los grupos. Las capturas y resultados se guardan en `/tmp/habita-qa`, `/tmp/habita-life-qa` y `/tmp/habita-life-ux`.

El acuerdo de componentes, responsables y criterios de esta versión está en [docs/LIFE-DEVELOPMENT.md](docs/LIFE-DEVELOPMENT.md). Los recorridos de aceptación están en [docs/QA-LIFE.md](docs/QA-LIFE.md); la regresión del piloto, en [docs/QA.md](docs/QA.md).

La autonomía combina reglas, memoria local y planificación. Los vecinos tienen rutinas y pueden iniciar conversaciones; el personaje desarrolla dibujos, plantas y recetas con consecuencias persistentes. El editor permite combinar rostros, cabello, siluetas, prendas y accesorios sin elegir género. La tienda incluye ropa, muebles funcionales y tres trajes originales de la colección Italian brainrot.

Cada cuenta real/ensayo tiene su propio monedero, casa e historia. El saldo inicial es 180 monedas ficticias; las compras son explícitas y únicas. El catálogo define precios, recompensas y límites. No hay pagos, deudas ni pérdida de objetos por ausencias. Las necesidades del mundo son ficticias y no miden tu salud.

La simulación no tiene conciencia subjetiva ni registra actividades reales automáticamente. Se detiene al cerrar la app y reconstruye un resumen acotado al regresar. Los avisos funcionan con Habita abierta. La foto es una referencia; no reconstruye dimensiones. Las fuentes científicas y sus límites se consultan dentro de la app. Esta versión funciona sin IA externa, claves ni servidor de datos.
