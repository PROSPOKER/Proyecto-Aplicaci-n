# Habita

Piloto de autocuidado: configurar objetivos, recibir una propuesta, realizarla a tu ritmo y registrar «Ya lo hice». Un mundo isométrico acompaña esos pasos con calma.

Sitio: https://prospoker.github.io/Proyecto-Aplicaci-n/

Aplicación estática, sin compilación. GitHub Pages publica `main` desde la raíz; `.nojekyll` permite servir los archivos directamente. La versión aparece en la interfaz. Un commit subido no confirma que Pages haya terminado su despliegue.

## Organización

| Archivo | Responsabilidad |
| --- | --- |
| `index.html` | Estructura y estilos de la interfaz original |
| `domain.js` | Estado inicial, acciones, decisiones, consecuencias y fecha coherente |
| `world.js` | Rutas, colisiones, entrada manual, cámara, NPC y eventos |
| `care.js` | Objetivos, horarios, evidencia y configuración de la casa |
| `ambience.js` | Escenas compactas, ilustración, animaciones y ciclo de luz |
| `companion.js` | Autonomía contextual, temporizador, avisos y audio opcional |
| `app.js` | Integración, persistencia validada y controles del piloto |
| `world-style.css` | Presentación de los nuevos escenarios y ajustes móviles |

Se conserva `habita-pilot-v2`, el perfil, la foto, los registros y la separación real/ensayo. Los nuevos campos son opcionales para copias anteriores. Un guardado incompatible se conserva sin sobrescribir y puede exportarse para revisarlo. El barrio original sigue en «Mis lugares anteriores».

## Desarrollo y verificación

Para desarrollo, sirve la carpeta con `python3 -m http.server 8765`. No requiere instalar nada para usar la versión pública en navegador.

Las pruebas de aceptación usan Node, Playwright y Chromium: `node tests/browser.cjs`. Por defecto consultan `http://127.0.0.1:8765`; se puede ajustar con `HABITA_TEST_URL`. `CHROMIUM_PATH` cambia el ejecutable y `HABITA_TEST_GROUP` limita los grupos. Las capturas y resultados se guardan en `/tmp/habita-qa`.

El acuerdo de componentes, responsables y criterios está en [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md). Los resultados y límites de verificación están en [docs/QA.md](docs/QA.md).

La autonomía combina reglas, memoria local y variación dentro de un catálogo ampliable. No tiene conciencia y no registra actividades reales automáticamente. Los avisos funcionan con Habita abierta. La foto es una referencia; no reconstruye dimensiones. Las fuentes científicas y sus límites se consultan dentro de la app.
