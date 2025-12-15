### Proyecto

**Weatherly Admin Dashboard** basada en el dashboard que se puede encontrar en Dribble Dashboards es una pequeña aplicación web que muestra datos meteorológicos usando la API pública **Open‑Meteo**. Incluye un **modal inicial** para seleccionar la ubicación (presets como Montevideo y Bogotá o coordenadas personalizadas), un gráfico de **tendencia de temperatura** por hora y un gráfico de **precipitación de los últimos 7 días** (la barra más a la derecha es hoy). El diseño es responsivo y accesible, con manejo de foco en el modal y persistencia de la ubicación en `localStorage`.

---

### Requisitos e instalación

**Requisitos**

- Navegador moderno con soporte para `fetch`, `ES6` y `Canvas` (Chart.js).
- Conexión a Internet para cargar Chart.js desde CDN y consultar Open‑Meteo.

**Instalación rápida**

1. Coloca los archivos `index.html`, `styles.css` y `unified-script.js` en la misma carpeta.
2. Abre `index.html` en el navegador o sirve la carpeta con un servidor estático (recomendado para evitar restricciones CORS locales).

**Comandos útiles**

```bash
# ejemplo con Python (servidor local)
python3 -m http.server 8000
# luego abrir http://localhost:8000 en el navegador
```

---

### Estructura de archivos

- **index.html** — Marcado principal; incluye el modal de selección de ubicación y los `canvas` para los gráficos.
- **styles.css** — Estilos del layout, tarjetas, modal y gráficos; responsive y con variables CSS para tema.
- **unified-script.js** — Lógica unificada: modal, persistencia en `localStorage`, llamadas a Open‑Meteo, y renderizado con Chart.js.
- **assets/** (opcional) — logos o imágenes usadas por la interfaz.

---

### Uso y comportamiento

**Flujo inicial**

- Al cargar la página, si no existe `weather_location` en `localStorage`, se abre automáticamente el **modal** para elegir ubicación.
- El usuario puede seleccionar un preset (por ejemplo **Bogotá**) o introducir latitud/longitud personalizadas. Al confirmar, la elección se guarda y se cargan los datos.

**Interacción**

- El modal **trapa el foco** y usa `role="dialog"` y `aria-modal="true"` para accesibilidad.
- La ubicación seleccionada se muestra en la cabecera en la **badge** `#location-badge`.
- El gráfico de precipitación muestra los **últimos 7 días** (ordenados de más antiguo a más reciente), con la barra de **hoy resaltada**.
- El gráfico de temperatura muestra la **tendencia horaria de hoy**; si faltan datos horarios para hoy, se usa un fallback de las primeras 24 horas disponibles.

**Reabrir modal**

- Usa el botón **Cambiar ubicación** en la cabecera para volver a abrir el modal y cambiar la ubicación en cualquier momento.

---

### Personalización y debugging

**Cambiar coordenadas por defecto**

- Edita `CONFIG.latitude` y `CONFIG.longitude` dentro de `unified-script.js` para modificar la ubicación por defecto.

**Forzar modal para pruebas**

- En la consola del navegador ejecuta:

```js
localStorage.removeItem('weather_location');
location.reload();
```

**Logs y errores**

- El script escribe mensajes de inicio y errores en la consola (`console.log`, `console.warn`, `console.error`).
- Si el modal no aparece, verifica que los elementos con IDs `locationModal` y `modal-backdrop` existan en el DOM y que el script se cargue con `defer`.

**Validación**

- El modal valida que latitud y longitud sean números; puedes añadir validación adicional (rango lat: -90..90, lon: -180..180) en `unified-script.js`.

---

### Licencia y notas finales

**Licencia**

- Código de ejemplo para uso educativo y prototipado. Adapta la licencia según tus necesidades (por ejemplo MIT).

**Notas**

- Open‑Meteo es una API pública sin clave para los endpoints usados; revisa su documentación si necesitas parámetros adicionales (idioma, unidades, variables extra).
- Para producción considera: manejo de errores más robusto, límites de peticiones, y tests de accesibilidad.
