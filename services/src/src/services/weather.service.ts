/**
 * OpenWeather — current conditions + daily forecast.
 * Docs: https://openweathermap.org/api
 */
import { env } from '../config/env.js';
import { ApiError } from '../lib/ApiError.js';
import { httpRequest } from '../lib/httpClient.js';
import type { ForecastDay, WeatherNow, WeatherQuery, WeatherResult } from '../types/index.js';

const BASE = 'https://api.openweathermap.org/data/2.5';

function assertConfigured(): void {
  if (!env.openWeatherApiKey) {
    throw ApiError.serviceUnavailable(
      'weather_not_configured',
      'OpenWeather key is not set. Define OPENWEATHER_API_KEY.',
    );
  }
}

const msToKmh = (ms: number) => Math.round(ms * 3.6);

interface RawNow {
  name: string;
  main: { temp: number; feels_like: number; humidity: number };
  wind: { speed: number };
  weather: { description: string; icon: string }[];
}
interface RawForecast {
  list: {
    dt_txt: string;
    main: { temp_min: number; temp_max: number };
    weather: { description: string; icon: string }[];
  }[];
}

export const weatherService = {
  async getWeather(q: WeatherQuery): Promise<WeatherResult> {
    assertConfigured();
    const common = {
      lat: q.lat,
      lon: q.lng,
      units: q.units ?? 'metric',
      lang: q.lang ?? 'fr',
      appid: env.openWeatherApiKey,
    };

    const [now, forecast] = await Promise.all([
      httpRequest<RawNow>(`${BASE}/weather`, { provider: 'openweather', query: common }),
      httpRequest<RawForecast>(`${BASE}/forecast`, { provider: 'openweather', query: common }),
    ]);

    const current: WeatherNow = {
      tempC: Math.round(now.main.temp),
      feelsLikeC: Math.round(now.main.feels_like),
      condition: now.weather[0]?.description ?? '',
      icon: now.weather[0]?.icon ?? '01d',
      humidity: now.main.humidity,
      windKmh: msToKmh(now.wind.speed),
    };

    // Reduce 3-hourly forecast to per-day min/max.
    const byDay = new Map<string, { min: number; max: number; icon: string; condition: string }>();
    for (const slot of forecast.list) {
      const date = slot.dt_txt.slice(0, 10);
      const entry = byDay.get(date);
      const min = slot.main.temp_min;
      const max = slot.main.temp_max;
      if (!entry) {
        byDay.set(date, {
          min,
          max,
          icon: slot.weather[0]?.icon ?? '01d',
          condition: slot.weather[0]?.description ?? '',
        });
      } else {
        entry.min = Math.min(entry.min, min);
        entry.max = Math.max(entry.max, max);
      }
    }
    const daily: ForecastDay[] = [...byDay.entries()].slice(0, 5).map(([date, d]) => ({
      date,
      minC: Math.round(d.min),
      maxC: Math.round(d.max),
      condition: d.condition,
      icon: d.icon,
    }));

    return { place: now.name, now: current, daily };
  },
};
