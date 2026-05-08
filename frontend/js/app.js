// Atmos — weather dashboard logic
(function () {
  const els = {
    nav: {
      greeting: document.getElementById('greeting'),
      login: document.getElementById('loginLink'),
      signup: document.getElementById('signupLink'),
      logout: document.getElementById('logoutBtn')
    },
    search: {
      form: document.getElementById('searchForm'),
      input: document.getElementById('searchInput'),
      results: document.getElementById('searchResults'),
      hint: document.getElementById('searchHint')
    },
    saved: {
      section: document.getElementById('savedSection'),
      list: document.getElementById('savedList')
    },
    report: {
      root: document.getElementById('report'),
      locale: document.getElementById('reportLocale'),
      city: document.getElementById('reportCity'),
      time: document.getElementById('reportTime'),
      tempValue: document.getElementById('tempValue'),
      condition: document.getElementById('conditionText'),
      feels: document.getElementById('feelsLike'),
      humidity: document.getElementById('mHumidity'),
      wind: document.getElementById('mWind'),
      pressure: document.getElementById('mPressure'),
      clouds: document.getElementById('mClouds'),
      sunrise: document.getElementById('mSunrise'),
      sunset: document.getElementById('mSunset'),
      forecast: document.getElementById('forecastList'),
      saveBtn: document.getElementById('saveBtn')
    },
    empty: document.getElementById('emptyState'),
    error: document.getElementById('errorBanner')
  };

  let currentLocation = null; // { name, country, latitude, longitude }

  // --- Weather code descriptions (WMO) ---
  const WX = {
    0: 'Clear sky',
    1: 'Mostly clear',
    2: 'Partly cloudy',
    3: 'Overcast',
    45: 'Foggy', 48: 'Rime fog',
    51: 'Light drizzle', 53: 'Drizzle', 55: 'Heavy drizzle',
    56: 'Freezing drizzle', 57: 'Heavy freezing drizzle',
    61: 'Light rain', 63: 'Rain', 65: 'Heavy rain',
    66: 'Freezing rain', 67: 'Heavy freezing rain',
    71: 'Light snow', 73: 'Snow', 75: 'Heavy snow',
    77: 'Snow grains',
    80: 'Rain showers', 81: 'Heavy rain showers', 82: 'Violent rain showers',
    85: 'Snow showers', 86: 'Heavy snow showers',
    95: 'Thunderstorm', 96: 'Thunderstorm w/ hail', 99: 'Severe thunderstorm'
  };
  const wxText = (c) => WX[c] || 'Unknown conditions';

  // --- Nav state ---
  function refreshNav() {
    const u = Auth.user();
    if (u) {
      els.nav.greeting.textContent = `Hello, ${u.displayName || u.email.split('@')[0]}`;
      els.nav.login.classList.add('hidden');
      els.nav.signup.classList.add('hidden');
      els.nav.logout.classList.remove('hidden');
    } else {
      els.nav.greeting.textContent = '';
      els.nav.login.classList.remove('hidden');
      els.nav.signup.classList.remove('hidden');
      els.nav.logout.classList.add('hidden');
    }
  }
  els.nav.logout.addEventListener('click', () => {
    if (typeof pendo !== 'undefined') {
      pendo.track('user_logged_out');
    }
    Auth.logout();
    location.reload();
  });

  // --- Errors ---
  function showError(msg) {
    els.error.textContent = msg;
    els.error.classList.remove('hidden');
    setTimeout(() => els.error.classList.add('hidden'), 5000);
  }

  // --- Search ---
  els.search.form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const q = els.search.input.value.trim();
    if (!q) return;
    els.search.results.innerHTML = '';
    try {
      const data = await Auth.request(`/api/weather/geocode?q=${encodeURIComponent(q)}`);
      if (!data.results.length) {
        if (typeof pendo !== 'undefined') {
          pendo.track('weather_search_executed', {
            query: q,
            resultsCount: 0,
            hasResults: false
          });
        }
        els.search.hint.textContent = 'No matching places. Try another spelling?';
        return;
      }
      if (typeof pendo !== 'undefined') {
        pendo.track('weather_search_executed', {
          query: q,
          resultsCount: data.results.length,
          hasResults: data.results.length > 0
        });
      }
      els.search.hint.textContent = 'Select a location:';
      data.results.forEach((p) => {
        const item = document.createElement('div');
        item.className = 'search__result';
        item.setAttribute('role', 'option');
        const locale = [p.admin1, p.country].filter(Boolean).join(', ');
        item.innerHTML = `
          <div>
            <div class="search__result-name">${p.name}</div>
            <div class="mono dim" style="font-size:.75rem;margin-top:2px">${locale}</div>
          </div>
          <div class="search__result-coords">${p.latitude.toFixed(2)}, ${p.longitude.toFixed(2)}</div>
        `;
        item.addEventListener('click', () => {
          els.search.results.innerHTML = '';
          els.search.hint.textContent = '';
          loadForecast(p);
        });
        els.search.results.appendChild(item);
      });
    } catch (err) {
      showError(err.message);
    }
  });

  // --- Forecast loading + render ---
  async function loadForecast(place) {
    currentLocation = place;
    els.empty.hidden = true;
    try {
      const data = await Auth.request(
        `/api/weather/forecast?lat=${place.latitude}&lon=${place.longitude}`
      );
      renderReport(place, data);
      if (typeof pendo !== 'undefined') {
        pendo.track('forecast_loaded', {
          locationName: place.name,
          country: place.country || '',
          latitude: place.latitude,
          longitude: place.longitude,
          weatherCondition: wxText((data.current || {}).weather_code),
          temperature: Math.round((data.current || {}).temperature_2m),
          source: 'search'
        });
      }
    } catch (err) {
      showError(err.message);
    }
  }

  function renderReport(place, data) {
    const cur = data.current || {};
    const daily = data.daily || {};
    const tz = data.timezone || 'UTC';

    els.report.locale.textContent = [place.admin1, place.country].filter(Boolean).join(' · ');
    els.report.city.textContent = place.name;

    const localTime = new Date(cur.time + 'Z'); // open-meteo current.time is local-naive, but readable
    els.report.time.textContent =
      `Observed ${cur.time} · ${tz}`;

    els.report.tempValue.textContent = Math.round(cur.temperature_2m);
    els.report.condition.textContent = wxText(cur.weather_code);
    els.report.feels.textContent = `feels like ${Math.round(cur.apparent_temperature)}°F`;

    els.report.humidity.textContent = `${cur.relative_humidity_2m}%`;
    els.report.wind.textContent = `${Math.round(cur.wind_speed_10m)} mph ${compass(cur.wind_direction_10m)}`;
    els.report.pressure.textContent = `${Math.round(cur.pressure_msl)} hPa`;
    els.report.clouds.textContent = `${cur.cloud_cover}%`;
    els.report.sunrise.textContent = fmtTime(daily.sunrise?.[0]);
    els.report.sunset.textContent = fmtTime(daily.sunset?.[0]);

    // Forecast rows
    els.report.forecast.innerHTML = '';
    const days = (daily.time || []).length;
    const allTemps = [...(daily.temperature_2m_min || []), ...(daily.temperature_2m_max || [])];
    const minT = Math.min(...allTemps);
    const maxT = Math.max(...allTemps);
    const range = Math.max(1, maxT - minT);

    for (let i = 0; i < days; i++) {
      const date = new Date(daily.time[i]);
      const hi = Math.round(daily.temperature_2m_max[i]);
      const lo = Math.round(daily.temperature_2m_min[i]);
      const code = daily.weather_code[i];
      const rain = daily.precipitation_probability_max?.[i] ?? 0;

      const dayLabel = i === 0
        ? 'Today'
        : date.toLocaleDateString(undefined, { weekday: 'long' });

      const fillStart = ((lo - minT) / range) * 100;
      const fillWidth = Math.max(6, ((hi - lo) / range) * 100);

      const li = document.createElement('li');
      li.className = 'forecast__row';
      li.innerHTML = `
        <div class="forecast__day">${dayLabel}</div>
        <div>
          <div class="forecast__cond">${wxText(code)}</div>
          ${rain > 0 ? `<div class="forecast__rain">${rain}% chance of precip</div>` : ''}
        </div>
        <div class="forecast__bar">
          <div class="forecast__bar-fill" style="left:${fillStart}%; width:${fillWidth}%"></div>
        </div>
        <div class="forecast__temps">
          <span class="forecast__hi">${hi}°</span>
          <span class="forecast__lo">${lo}°</span>
        </div>
      `;
      els.report.forecast.appendChild(li);
    }

    els.report.root.hidden = false;

    // Show "Save location" button only when logged in
    if (Auth.token()) {
      els.report.saveBtn.classList.remove('hidden');
    } else {
      els.report.saveBtn.classList.add('hidden');
    }
  }

  function compass(deg) {
    const dirs = ['N','NE','E','SE','S','SW','W','NW'];
    return dirs[Math.round(((deg || 0) % 360) / 45) % 8];
  }
  function fmtTime(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  // --- Saved locations ---
  els.report.saveBtn.addEventListener('click', async () => {
    if (!currentLocation || !Auth.token()) return;
    const label = [currentLocation.name, currentLocation.country].filter(Boolean).join(', ');
    try {
      await Auth.request('/api/auth/locations', {
        method: 'POST',
        body: JSON.stringify({
          label,
          latitude: currentLocation.latitude,
          longitude: currentLocation.longitude
        })
      });
      if (typeof pendo !== 'undefined') {
        pendo.track('location_saved', {
          locationLabel: label,
          latitude: currentLocation.latitude,
          longitude: currentLocation.longitude
        });
      }
      els.report.saveBtn.textContent = '✓ Saved';
      setTimeout(() => (els.report.saveBtn.textContent = '+ Save location'), 1800);
      loadSaved();
    } catch (err) {
      showError(err.message);
    }
  });

  async function loadSaved() {
    if (!Auth.token()) {
      els.saved.section.hidden = true;
      return;
    }
    try {
      const list = await Auth.request('/api/auth/locations');
      els.saved.list.innerHTML = '';
      if (!list.length) {
        els.saved.section.hidden = true;
        return;
      }
      list.forEach((loc) => {
        const item = document.createElement('div');
        item.className = 'saved__item';
        item.innerHTML = `
          <span class="saved__item-name">${loc.label}</span>
          <button class="saved__item-remove" title="Remove" aria-label="Remove">×</button>
        `;
        item.addEventListener('click', (e) => {
          if (e.target.classList.contains('saved__item-remove')) return;
          loadForecast({
            name: loc.label.split(',')[0],
            country: loc.label.split(',').slice(1).join(',').trim() || null,
            admin1: null,
            latitude: loc.latitude,
            longitude: loc.longitude
          });
        });
        item.querySelector('.saved__item-remove').addEventListener('click', async (e) => {
          e.stopPropagation();
          try {
            await Auth.request(`/api/auth/locations/${loc.id}`, { method: 'DELETE' });
            if (typeof pendo !== 'undefined') {
              pendo.track('location_removed', {
                locationId: loc.id,
                locationLabel: loc.label
              });
            }
            loadSaved();
          } catch (err) {
            showError(err.message);
          }
        });
        els.saved.list.appendChild(item);
      });
      els.saved.section.hidden = false;
    } catch (_) {
      els.saved.section.hidden = true;
    }
  }

  // --- Init ---
  refreshNav();
  loadSaved();
})();
