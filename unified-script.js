/* unified-script.js
   - Modal location selection + Open-Meteo integration + Chart.js rendering
   - Single file to include as <script src="unified-script.js" defer></script>
   - Requires Chart.js loaded in the page (via CDN in index.html)
*/

(() => {
  /* -------------------------
     Shared CONFIG (defaults)
  ------------------------- */
  const CONFIG = {
    latitude: -34.9,   // default Montevideo
    longitude: -56.2,
    timezone: 'auto',
    hourlyVars: ['temperature_2m'],
    dailyVars: ['temperature_2m_max', 'temperature_2m_min', 'precipitation_sum', 'sunrise', 'sunset'],
    refreshIntervalMs: 60 * 60 * 1000 // 1 hour
  };

  /* -------------------------
     Utility helpers
  ------------------------- */
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  function pad(n) { return String(n).padStart(2, '0'); }

  function isoDate(d) {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  function formatHourLabel(iso) {
    const d = new Date(iso);
    const h = d.getHours();
    return `${h}:00`;
  }

  function formatWeekdayShort(iso, locale = 'es-ES') {
    return new Date(iso).toLocaleDateString(locale, { weekday: 'short' });
  }

  function formatWeekdayWithDate(iso, locale = 'es-ES') {
    const d = new Date(iso);
    const weekday = d.toLocaleDateString(locale, { weekday: 'short' });
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return `${weekday} ${day}/${month}`;
  }

  function safeText(selector, text) {
    const el = $(selector);
    if (el) el.textContent = text;
  }

  function last7Range() {
    const end = new Date();
    const start = new Date(end);
    start.setDate(end.getDate() - 6);
    return { startDate: isoDate(start), endDate: isoDate(end) };
  }

  /* -------------------------
     Preset locations
  ------------------------- */
  const PRESETS = {
    montevideo: { lat: -34.9, lon: -56.1667 },
    bogota:    { lat: 4.7110,  lon: -74.0721 },
    sydney:    { lat: -33.8688, lon: 151.2093 },
    melbourne: { lat: -37.8136, lon: 144.9631 },
    perth:     { lat: -31.9505, lon: 115.8605 },
    darwin:    { lat: -12.4634, lon: 130.8456 }
  };

  /* -------------------------
     Chart instances
  ------------------------- */
  let tempChart = null;
  let precipChart = null;

  /* -------------------------
     Modal helpers
  ------------------------- */
  function getFocusable(container) {
    return Array.from(container.querySelectorAll('a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'))
      .filter(el => !el.hasAttribute('disabled') && el.offsetParent !== null);
  }

  function trapFocus(modalEl) {
    const focusables = getFocusable(modalEl);
    if (!focusables.length) return () => {};
    const first = focusables[0];
    const last = focusables[focusables.length - 1];

    function onKey(e) {
      if (e.key === 'Tab') {
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      } else if (e.key === 'Escape') {
        closeLocationModal();
      }
    }

    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }

  let modalElements = null;
  let removeTrap = null;
  let previouslyFocused = null;

  function openLocationModal() {
    if (!modalElements) return;
    const { modal, backdrop } = modalElements;
    if (!modal || !backdrop) return;
    previouslyFocused = document.activeElement;
    modal.hidden = false;
    backdrop.hidden = false;
    const layout = document.querySelector('.layout');
    if (layout) layout.setAttribute('aria-hidden', 'true');
    const firstControl = modal.querySelector('select, input, button');
    if (firstControl) firstControl.focus();
    removeTrap = trapFocus(modal);
  }

  function closeLocationModal() {
    if (!modalElements) return;
    const { modal, backdrop } = modalElements;
    if (!modal || !backdrop) return;
    modal.hidden = true;
    backdrop.hidden = true;
    const layout = document.querySelector('.layout');
    if (layout) layout.removeAttribute('aria-hidden');
    if (removeTrap) removeTrap();
    if (previouslyFocused) previouslyFocused.focus();
  }

  function dispatchLocationSelected(lat, lon) {
    const ev = new CustomEvent('locationSelected', {
      detail: { lat: Number(lat), lon: Number(lon) },
      bubbles: true,
      composed: true
    });
    document.dispatchEvent(ev);
  }

  function saveLocationAndClose(lat, lon) {
    try {
      localStorage.setItem('weather_location', JSON.stringify({ lat, lon }));
    } catch (e) { /* ignore */ }

    CONFIG.latitude = Number(lat);
    CONFIG.longitude = Number(lon);

    dispatchLocationSelected(lat, lon);
    closeLocationModal();
    loadWeather();
  }

  /* -------------------------
     Main: loadWeather (Open-Meteo + Chart.js)
  ------------------------- */
  async function loadWeather() {
    const { startDate, endDate } = last7Range();
    const base = 'https://api.open-meteo.com/v1/forecast';
    const hourly = CONFIG.hourlyVars.join(',');
    const daily = CONFIG.dailyVars.join(',');

    const url = `${base}?latitude=${CONFIG.latitude}&longitude=${CONFIG.longitude}` +
                `&daily=${daily}` +
                `&hourly=${hourly}` +
                `&start_date=${startDate}&end_date=${endDate}` +
                `&timezone=${CONFIG.timezone}`;

    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      // Update location badge
      const locBadge = $('#location-badge');
      if (locBadge) locBadge.textContent = `Lat ${CONFIG.latitude.toFixed(2)}, Lon ${CONFIG.longitude.toFixed(2)}`;

      // Today's summary (last element)
      const dailyTimes = data.daily?.time || [];
      const lastIndex = dailyTimes.length - 1;

      const todayMax = data.daily?.temperature_2m_max?.[lastIndex];
      const todayMin = data.daily?.temperature_2m_min?.[lastIndex];
      const sunrise = data.daily?.sunrise?.[lastIndex];
      const sunset = data.daily?.sunset?.[lastIndex];

      safeText('.metric__value', todayMax != null ? `${todayMax}°C` : 'N/D');
      safeText('.metric__range', (todayMax != null && todayMin != null) ? `Max ${todayMax}°C • Min ${todayMin}°C` : 'Max -- • Min --');
      safeText('#sunrise', sunrise ? new Date(sunrise).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : '--:--');
      safeText('#sunset', sunset ? new Date(sunset).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : '--:--');

      // Fill forecast cards (si está presente)
      const daysEls = $$('.forecast .day');
      dailyTimes.forEach((iso, i) => {
        const el = daysEls[i];
        if (!el) return;
        const name = formatWeekdayShort(iso);
        const temp = data.daily?.temperature_2m_max?.[i];
        const nameEl = el.querySelector('.day__name');
        const tempEl = el.querySelector('.day__temp');
        if (nameEl) nameEl.textContent = name;
        if (tempEl) tempEl.textContent = temp != null ? `${temp}°C` : '--°C';
      });

      // Temperatuyre trend
      const hourlyTimes = data.hourly?.time || [];
      const hourlyTemps = data.hourly?.temperature_2m || [];

      const hoursForToday = [];
      const tempsForToday = [];
      for (let i = 0; i < hourlyTimes.length; i++) {
        const iso = hourlyTimes[i];
        if (!iso) continue;
        const d = new Date(iso);
        const isoDateOnly = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
        if (isoDateOnly === endDate) {
          hoursForToday.push(formatHourLabel(iso));
          tempsForToday.push(hourlyTemps[i]);
        }
      }

      const hours = hoursForToday.length ? hoursForToday : hourlyTimes.slice(0, 24).map(formatHourLabel);
      const temps = tempsForToday.length ? tempsForToday : (hourlyTemps.slice(0, 24));

      if (tempChart) { tempChart.destroy(); tempChart = null; }
      const tempCanvas = document.getElementById('tempTrend');
      if (tempCanvas) {
        const tempCtx = tempCanvas.getContext('2d');
        tempChart = new Chart(tempCtx, {
          type: 'line',
          data: {
            labels: hours,
            datasets: [{
              label: 'Temperatura (°C)',
              data: temps,
              borderColor: getComputedStyle(document.documentElement).getPropertyValue('--primary')?.trim() || '#4ea6ff',
              backgroundColor: 'rgba(78,166,255,0.18)',
              tension: 0.3,
              pointRadius: 2,
              fill: true
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false }, tooltip: { mode: 'index', intersect: false } },
            scales: { x: { display: true, grid: { display: false } }, y: { display: true, beginAtZero: false } }
          }
        });
      }

      // Precipitation (Últimos 7 días)
      const precipTimes = data.daily?.time || [];
      const precipData = data.daily?.precipitation_sum || [];
      const startIndex = Math.max(0, precipTimes.length - 7);
      const selectedTimes = precipTimes.slice(startIndex);
      const selectedPrecip = precipData.slice(startIndex);

      const precipLabels = selectedTimes.map(d => formatWeekdayWithDate(d));
      const precipValues = selectedPrecip;

      // Arreglo de colores para resaltar el color del día de hoy
      const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent')?.trim() || '#ffb545';
      const muted = 'rgba(255,255,255,0.08)';
      const bgColors = precipValues.map((_, i) => (i === precipValues.length - 1 ? accent : muted));

      if (precipChart) { precipChart.destroy(); precipChart = null; }
      const precipCanvas = document.getElementById('precipChart');
      if (precipCanvas) {
        const precipCtx = precipCanvas.getContext('2d');
        precipChart = new Chart(precipCtx, {
          type: 'bar',
          data: {
            labels: precipLabels,
            datasets: [{
              label: 'Precipitación (mm)',
              data: precipValues,
              backgroundColor: bgColors
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { x: { ticks: { maxRotation: 0, minRotation: 0 } }, y: { beginAtZero: true } }
          }
        });
      }

      
      if (temps && temps.length) {
        const maxTemp = Math.max(...temps);
        const maxIndex = temps.indexOf(maxTemp);
        const maxHour = hours[maxIndex] || '';
        safeText('#temp-note', `Pico: ${maxTemp}°C a las ${maxHour}`);
      } else {
        safeText('#temp-note', '—');
      }

    } catch (err) {
      console.error('Error fetching weather:', err);
      safeText('.metric__value', 'N/D');
      safeText('.metric__range', 'Max -- • Min --');
      safeText('#sunrise', '--:--');
      safeText('#sunset', '--:--');
      safeText('#temp-note', 'Datos no disponibles');
    }
  }

  /* -------------------------
     Wiring: DOMContentLoaded
  ------------------------- */
  document.addEventListener('DOMContentLoaded', () => {
    // Query modal elements and wire handlers (safe guards)
    const modal = document.getElementById('locationModal');
    const backdrop = document.getElementById('modal-backdrop');
    const closeBtn = document.getElementById('closeModalBtn');
    const presetSelect = document.getElementById('presetLocation');
    const customInputs = document.getElementById('customInputs');
    const useDefaultBtn = document.getElementById('useDefault');
    const locationForm = document.getElementById('locationForm');
    const changeLocationBtn = document.getElementById('changeLocationBtn');

    modalElements = { modal, backdrop, closeBtn, presetSelect, customInputs, useDefaultBtn, locationForm };

    // Attach handlers only if elements exist
    if (presetSelect) {
      presetSelect.addEventListener('change', (e) => {
        const val = e.target.value;
        if (val === 'custom') {
          if (customInputs) customInputs.hidden = false;
        } else {
          if (customInputs) customInputs.hidden = true;
          const coords = PRESETS[val];
          if (coords) {
            const latInput = document.getElementById('lat');
            const lonInput = document.getElementById('lon');
            if (latInput && lonInput) {
              latInput.value = coords.lat;
              lonInput.value = coords.lon;
            }
          }
        }
      });
    }

    if (useDefaultBtn) {
      useDefaultBtn.addEventListener('click', (e) => {
        e.preventDefault();
        saveLocationAndClose(CONFIG.latitude, CONFIG.longitude);
      });
    }

    if (locationForm) {
      locationForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const preset = presetSelect?.value;
        if (preset && preset !== 'custom') {
          const coords = PRESETS[preset];
          if (coords) {
            saveLocationAndClose(coords.lat, coords.lon);
            return;
          }
        }
        const latInput = document.getElementById('lat');
        const lonInput = document.getElementById('lon');
        const lat = latInput ? parseFloat(latInput.value) : NaN;
        const lon = lonInput ? parseFloat(lonInput.value) : NaN;
        if (!isNaN(lat) && !isNaN(lon)) {
          saveLocationAndClose(lat, lon);
        } else {
          if (latInput) {
            latInput.focus();
            latInput.setAttribute('aria-invalid', 'true');
          }
        }
      });
    }

    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        // fallback to default if user closes
        saveLocationAndClose(CONFIG.latitude, CONFIG.longitude);
      });
    }

    if (backdrop) {
      backdrop.addEventListener('click', () => {
        saveLocationAndClose(CONFIG.latitude, CONFIG.longitude);
      });
    }

    // Wire header change location button
    if (changeLocationBtn) {
      changeLocationBtn.addEventListener('click', (e) => {
        e.preventDefault();
        openLocationModal();
      });
    }

    // Listen for custom event (update badge)
    document.addEventListener('locationSelected', (ev) => {
      const { lat, lon } = ev.detail || {};
      if (typeof lat === 'number' && typeof lon === 'number') {
        const badge = document.getElementById('location-badge');
        if (badge) badge.textContent = `Lat ${lat.toFixed(2)}, Lon ${lon.toFixed(2)}`;
      }
    });

    // Al iniciar chequea location guardadas 
    try {
      const saved = JSON.parse(localStorage.getItem('weather_location'));
      if (saved && typeof saved.lat === 'number' && typeof saved.lon === 'number') {
        CONFIG.latitude = saved.lat;
        CONFIG.longitude = saved.lon;
        loadWeather();
      } else {
        if (modal && backdrop) openLocationModal();
        else loadWeather();
      }
    } catch (err) {
      console.warn('unified-script: error reading saved location', err);
      if (modal && backdrop) openLocationModal();
      else loadWeather();
    }

    // Refresh periodico
    setInterval(loadWeather, CONFIG.refreshIntervalMs);
  });

  /* Expone loadWeather y CONFIG para debugging o llamadas externas (opcional) */
  window.loadWeather = loadWeather;
  window.WEATHER_CONFIG = CONFIG;

})();
