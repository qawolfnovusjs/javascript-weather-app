const express = require('express');
const router = express.Router();

// Open-Meteo is a free, keyless weather API.
const GEOCODE_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';

router.get('/geocode', async (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) return res.status(400).json({ error: 'Query parameter "q" is required.' });

  try {
    const url = `${GEOCODE_URL}?name=${encodeURIComponent(q)}&count=5&language=en&format=json`;
    const r = await fetch(url);
    if (!r.ok) throw new Error(`Geocoding failed: ${r.status}`);
    const data = await r.json();
    const results = (data.results || []).map((p) => ({
      name: p.name,
      country: p.country,
      admin1: p.admin1 || null,
      latitude: p.latitude,
      longitude: p.longitude,
      timezone: p.timezone
    }));
    res.json({ results });
  } catch (err) {
    console.error('Geocode error:', err);
    res.status(502).json({ error: 'Could not look up that location.' });
  }
});

router.get('/forecast', async (req, res) => {
  const lat = parseFloat(req.query.lat);
  const lon = parseFloat(req.query.lon);
  if (Number.isNaN(lat) || Number.isNaN(lon)) {
    return res.status(400).json({ error: 'lat and lon are required.' });
  }

  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    current: [
      'temperature_2m',
      'apparent_temperature',
      'relative_humidity_2m',
      'precipitation',
      'weather_code',
      'wind_speed_10m',
      'wind_direction_10m',
      'pressure_msl',
      'cloud_cover',
      'is_day'
    ].join(','),
    hourly: ['temperature_2m', 'precipitation_probability', 'weather_code'].join(','),
    daily: [
      'weather_code',
      'temperature_2m_max',
      'temperature_2m_min',
      'sunrise',
      'sunset',
      'precipitation_sum',
      'precipitation_probability_max'
    ].join(','),
    timezone: 'auto',
    forecast_days: '7',
    temperature_unit: 'fahrenheit',
    wind_speed_unit: 'mph',
    precipitation_unit: 'inch'
  });

  try {
    const r = await fetch(`${FORECAST_URL}?${params.toString()}`);
    if (!r.ok) throw new Error(`Forecast failed: ${r.status}`);
    const data = await r.json();
    res.json(data);
  } catch (err) {
    console.error('Forecast error:', err);
    res.status(502).json({ error: 'Could not retrieve forecast.' });
  }
});

module.exports = router;
