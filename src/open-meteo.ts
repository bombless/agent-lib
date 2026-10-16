const API_TIMEOUT_MS = 12_000;

type JsonObject = Record<string, unknown>;

async function getJson(url: URL): Promise<JsonObject> {
  const response = await fetch(url, { signal: AbortSignal.timeout(API_TIMEOUT_MS), headers: { accept: 'application/json' } });
  if (!response.ok) throw new Error(`Open-Meteo request failed: HTTP ${response.status} ${response.statusText}`);
  const data: unknown = await response.json();
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Open-Meteo returned an invalid response');
  return data as JsonObject;
}

function requiredString(args: Record<string, unknown>, key: string): string {
  const value = args[key];
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error(`${key} must be a non-empty string`);
  return value.trim();
}

function optionalString(args: Record<string, unknown>, key: string, fallback: string): string {
  const value = args[key];
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value !== 'string') throw new Error(`${key} must be a string`);
  return value;
}

function dateArg(value: string, name: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`)) || new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) !== value) {
    throw new Error(`${name} must be a valid date in YYYY-MM-DD format`);
  }
  return value;
}

export async function geocodeLocation(location: string): Promise<{ name: string; latitude: number; longitude: number; country?: string; admin1?: string; timezone?: string }> {
  const url = new URL('https://geocoding-api.open-meteo.com/v1/search');
  url.search = new URLSearchParams({ name: location, count: '5', language: 'en', format: 'json' }).toString();
  const data = await getJson(url);
  const results = Array.isArray(data.results) ? data.results as JsonObject[] : [];
  if (results.length === 0) throw new Error(`No location found for "${location}"`);
  const first = results[0]!;
  return {
    name: String(first.name ?? location),
    latitude: Number(first.latitude),
    longitude: Number(first.longitude),
    ...(typeof first.country === 'string' ? { country: first.country } : {}),
    ...(typeof first.admin1 === 'string' ? { admin1: first.admin1 } : {}),
    ...(typeof first.timezone === 'string' ? { timezone: first.timezone } : {}),
  };
}

export async function runOpenMeteoTool(tool: string, args: Record<string, unknown>): Promise<unknown> {
  if (tool === 'geocode_location') {
    const location = requiredString(args, 'location');
    return { location: await geocodeLocation(location), source: 'Open-Meteo Geocoding API' };
  }

  if (tool === 'get_weather_forecast') {
    const location = requiredString(args, 'location');
    const place = await geocodeLocation(location);
    const url = new URL('https://api.open-meteo.com/v1/forecast');
    url.search = new URLSearchParams({
      latitude: String(place.latitude),
      longitude: String(place.longitude),
      current: 'temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m',
      daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum',
      forecast_days: '7',
      timezone: 'auto',
    }).toString();
    const data = await getJson(url);
    return { location: place, current: data.current, daily: data.daily, timezone: data.timezone, source: 'Open-Meteo Forecast API' };
  }

  if (tool === 'get_historical_weather') {
    const location = requiredString(args, 'location');
    const startDate = dateArg(requiredString(args, 'start_date'), 'start_date');
    const endDate = dateArg(requiredString(args, 'end_date'), 'end_date');
    if (startDate > endDate) throw new Error('start_date must be on or before end_date');
    const variablesValue = args.variables;
    const allowedVariables = new Set(['weather_code', 'temperature_2m_max', 'temperature_2m_min', 'temperature_2m_mean', 'sunshine_duration', 'precipitation_sum', 'rain_sum', 'wind_speed_10m_max']);
    let variables = ['weather_code', 'temperature_2m_max', 'temperature_2m_min', 'precipitation_sum'];
    if (variablesValue !== undefined) {
      if (!Array.isArray(variablesValue) || variablesValue.length === 0 || variablesValue.some(value => typeof value !== 'string' || !allowedVariables.has(value))) {
        throw new Error(`variables must be a non-empty array containing only: ${[...allowedVariables].join(', ')}`);
      }
      variables = [...new Set(variablesValue as string[])];
    }
    const place = await geocodeLocation(location);
    const url = new URL('https://archive-api.open-meteo.com/v1/archive');
    url.search = new URLSearchParams({
      latitude: String(place.latitude),
      longitude: String(place.longitude),
      start_date: startDate,
      end_date: endDate,
      daily: variables.join(','),
      timezone: optionalString(args, 'timezone', place.timezone ?? 'auto'),
    }).toString();
    const data = await getJson(url);
    return { location: place, start_date: startDate, end_date: endDate, daily: data.daily, timezone: data.timezone, source: 'Open-Meteo Historical Weather API', attribution: 'Weather data by Open-Meteo (CC BY 4.0)' };
  }

  throw new Error(`Unknown Open-Meteo tool: ${tool}`);
}
