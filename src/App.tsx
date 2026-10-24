import { useState, type FormEvent } from 'react'
import './App.css'

type Place = {
  name: string
  latitude: number
  longitude: number
  country: string
  admin1?: string
}

type Weather = {
  place: Place
  localDate: string
  temperature: number
  code: number
  humidity: number
  windSpeed: number
  forecast: ForecastDay[]
}

type ForecastDay = {
  date: string
  code: number
  high: number
  low: number
}

type WeatherCondition = {
  emoji: string
  label: string
}

function weatherCondition(code: number): WeatherCondition {
  if (code === 0) return { emoji: '☀️', label: 'Clear' }
  if (code === 1 || code === 2) return { emoji: '⛅', label: 'Partly cloudy' }
  if (code === 3) return { emoji: '☁️', label: 'Cloudy' }
  if (code === 45 || code === 48) return { emoji: '🌫️', label: 'Foggy' }
  if ([51, 53, 55, 56, 57].includes(code))
    return { emoji: '🌦️', label: 'Drizzly' }
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code))
    return { emoji: '🌧️', label: 'Rainy' }
  if ([71, 73, 75, 77, 85, 86].includes(code))
    return { emoji: '❄️', label: 'Snowy' }
  if ([95, 96, 99].includes(code))
    return { emoji: '⛈️', label: 'Thunderstorm' }
  return { emoji: '🌡️', label: 'Weather' }
}

function App() {
  const [query, setQuery] = useState('')
  const [weather, setWeather] = useState<Weather | null>(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  async function loadWeather(place: Place) {
    setLoading(true)
    setMessage('')
    setWeather(null)

    try {
      const params = new URLSearchParams({
        latitude: String(place.latitude),
        longitude: String(place.longitude),
        current:
          'temperature_2m,weather_code,relative_humidity_2m,wind_speed_10m',
        daily: 'weather_code,temperature_2m_max,temperature_2m_min',
        timezone: 'auto',
        wind_speed_unit: 'kmh',
        forecast_days: '4',
      })
      const response = await fetch(
        `https://api.open-meteo.com/v1/forecast?${params.toString()}`,
        { cache: 'no-store' },
      )

      if (!response.ok) {
        throw new Error('Weather request failed')
      }

      const data: {
        current?: {
          time?: string
          temperature_2m?: number
          weather_code?: number
          relative_humidity_2m?: number
          wind_speed_10m?: number
        }
        daily?: {
          time?: string[]
          weather_code?: number[]
          temperature_2m_max?: number[]
          temperature_2m_min?: number[]
        }
      } = await response.json()
      const currentTime = data.current?.time
      const temperature = data.current?.temperature_2m
      const code = data.current?.weather_code
      const humidity = data.current?.relative_humidity_2m
      const windSpeed = data.current?.wind_speed_10m
      const daily = data.daily
      const forecast: ForecastDay[] = []

      if (
        typeof temperature !== 'number' ||
        typeof code !== 'number' ||
        typeof humidity !== 'number' ||
        typeof windSpeed !== 'number' ||
        typeof currentTime !== 'string' ||
        !/^\d{4}-\d{2}-\d{2}/.test(currentTime) ||
        !daily?.time ||
        !daily.weather_code ||
        !daily.temperature_2m_max ||
        !daily.temperature_2m_min ||
        daily.time.length < 4
      ) {
        throw new Error('Weather data is unavailable')
      }

      for (let index = 1; index < 4; index += 1) {
        const dayCode = daily.weather_code[index]
        const high = daily.temperature_2m_max[index]
        const low = daily.temperature_2m_min[index]
        const date = daily.time[index]

        if (
          typeof dayCode !== 'number' ||
          typeof high !== 'number' ||
          typeof low !== 'number' ||
          typeof date !== 'string'
        ) {
          throw new Error('Weather data is unavailable')
        }

        forecast.push({ date, code: dayCode, high, low })
      }

      setWeather({
        place,
        localDate: currentTime.slice(0, 10),
        temperature,
        code,
        humidity,
        windSpeed,
        forecast,
      })
    } catch {
      setMessage("We couldn't load the weather right now. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  async function searchPlaces(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const searchTerm = query.trim()

    if (!searchTerm) {
      setMessage('Enter a city or place to get started.')
      setWeather(null)
      return
    }

    setLoading(true)
    setMessage('')
    setWeather(null)

    try {
      const params = new URLSearchParams({
        name: searchTerm,
        count: '1',
        language: 'en',
        format: 'json',
      })
      const response = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?${params.toString()}`,
      )

      if (!response.ok) {
        throw new Error('Place search failed')
      }

      const data: { results?: Place[] } = await response.json()
      const place = data.results?.[0]

      if (!place) {
        setMessage(
          'City not found. Please check the spelling and try again.',
        )
      } else {
        await loadWeather(place)
      }
    } catch {
      setMessage("We couldn't complete your search. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  function locationDetails(place: Place) {
    return [place.admin1, place.country].filter(Boolean).join(', ')
  }

  function formatApiDate(date: string, options: Intl.DateTimeFormatOptions) {
    return new Intl.DateTimeFormat('en-GB', {
      ...options,
      timeZone: 'UTC',
    }).format(new Date(`${date}T12:00:00Z`))
  }

  function formatForecastDate(date: string) {
    return formatApiDate(date, {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  }

  function formatCoordinate(value: number, positive: string, negative: string) {
    return `${Math.abs(value).toFixed(2)}° ${value >= 0 ? positive : negative}`
  }

  return (
    <main className="weather-app">
      <section className="weather-panel" aria-labelledby="page-title">
        <div className="eyebrow">YOUR WEATHER, WHEREVER YOU ARE</div>
        <h1 id="page-title">Find your forecast</h1>
        <p className="intro">
          Search for a city or place to see the current temperature.
        </p>

        <form className="search-form" onSubmit={searchPlaces}>
          <label className="visually-hidden" htmlFor="place-search">
            City or place
          </label>
          <input
            id="place-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Try Lagos, Texas, or Nairobi"
            autoComplete="off"
          />
          <button type="submit" disabled={loading}>
            Search
          </button>
        </form>

        {loading && (
          <p className="status-message" role="status">
            Finding your weather…
          </p>
        )}

        {!loading && message && (
          <p className="status-message status-error" role="status">
            {message}
          </p>
        )}

        {weather && (
          <section className="weather-content" aria-live="polite">
            <div className="weather-result">
              <div className="weather-icon" aria-hidden="true">
                {weatherCondition(weather.code).emoji}
              </div>
              <div className="current-details">
                <p className="result-label">CURRENT WEATHER</p>
                <h2>{weather.place.name}</h2>
                <p className="result-location">
                  {locationDetails(weather.place)}
                </p>
                <p className="current-date">
                  {formatApiDate(weather.localDate, {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </p>
                <p className="condition-label">
                  {weatherCondition(weather.code).label}
                </p>
              </div>
              <div className="temperature">
                {Math.round(weather.temperature)}
                <span>°C</span>
              </div>
            </div>

            <div className="weather-coordinates">
              <div className="weather-metric">
                <span className="metric-details">
                  <span className="metric-label">Latitude</span>
                  <span className="metric-value">
                    {formatCoordinate(weather.place.latitude, 'N', 'S')}
                  </span>
                </span>
              </div>
              <div className="weather-metric">
                <span className="metric-details">
                  <span className="metric-label">Longitude</span>
                  <span className="metric-value">
                    {formatCoordinate(weather.place.longitude, 'E', 'W')}
                  </span>
                </span>
              </div>
            </div>

            <div className="weather-metrics">
              <div className="weather-metric">
                <span className="metric-icon" aria-hidden="true">
                  💧
                </span>
                <span className="metric-details">
                  <span className="metric-label">Humidity</span>
                  <span className="metric-value">{weather.humidity}%</span>
                </span>
              </div>
              <div className="weather-metric">
                <span className="metric-icon" aria-hidden="true">
                  💨
                </span>
                <span className="metric-details">
                  <span className="metric-label">Wind</span>
                  <span className="metric-value">
                    {weather.windSpeed} km/h
                  </span>
                </span>
              </div>
            </div>

            <div className="forecast">
              <h2>3-day forecast</h2>
              <div className="forecast-cards">
                {weather.forecast.map((day) => {
                  const condition = weatherCondition(day.code)
                  const dayName =
                    day.date === weather.forecast[0].date
                      ? 'Tomorrow'
                      : formatApiDate(day.date, { weekday: 'long' })

                  return (
                    <article className="forecast-card" key={day.date}>
                      <h3>
                        {dayName}
                        <br />
                        <span className="forecast-date">
                          {formatForecastDate(day.date)}
                        </span>
                      </h3>
                      <span
                        className="forecast-emoji"
                        aria-label={condition.label}
                      >
                        {condition.emoji}
                      </span>
                      <p>
                        <span className="forecast-high">
                          <span className="forecast-indicator" aria-hidden="true">
                            ▲
                          </span>
                          {Math.round(day.high)}°
                        </span>
                        <span className="forecast-low">
                          <span className="forecast-indicator" aria-hidden="true">
                            ▼
                          </span>
                          {Math.round(day.low)}°
                        </span>
                      </p>
                    </article>
                  )
                })}
              </div>
            </div>
          </section>
        )}

        <p className="attribution">Weather data by Open-Meteo</p>
      </section>
    </main>
  )
}

export default App
