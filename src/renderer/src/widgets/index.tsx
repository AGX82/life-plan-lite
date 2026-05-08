import {
  AlarmClock,
  BookOpenText,
  CloudSun,
  Clock3,
  Globe2
} from 'lucide-react'
import { useEffect, useState } from 'react'
import type { ReactElement } from 'react'
import type {
  BoardWidget,
  BoardWidgetConfig,
  WeatherApproximateLocation,
  WidgetType
} from '@shared/domain'

export const widgetTypes: Array<{ value: WidgetType; label: string; icon: typeof Clock3 }> = [
  { value: 'clock', label: 'Clock', icon: Clock3 },
  { value: 'weather', label: 'Weather', icon: CloudSun },
  { value: 'world_clocks', label: 'World Clock', icon: Globe2 },
  { value: 'word_of_day', label: 'Word of the Day', icon: BookOpenText },
  { value: 'countdown', label: 'Countdown', icon: AlarmClock }
]

export function widgetTypeLabel(type: WidgetType): string {
  return widgetTypes.find((entry) => entry.value === type)?.label ?? 'Widget'
}

export type WidgetAspectSpec = {
  ratioW: number
  ratioH: number
  minScale: number
}

export function widgetAspectSpec(type: WidgetType, config: BoardWidgetConfig): WidgetAspectSpec {
  if (type === 'countdown') return { ratioW: 3, ratioH: 2, minScale: 1 }
  if (type === 'world_clocks') {
    const count = clamp(config.worldClocks?.locations?.length ?? 2, 2, 16)
    return { ratioW: count, ratioH: 2, minScale: 1 }
  }
  return { ratioW: 1, ratioH: 1, minScale: 2 }
}

export function widgetScaleBounds(spec: WidgetAspectSpec): { min: number; max: number } {
  return {
    min: spec.minScale,
    max: Math.max(spec.minScale, Math.min(Math.floor(16 / spec.ratioW), Math.floor(8 / spec.ratioH)))
  }
}

export function widgetGridForScale(spec: WidgetAspectSpec, scale: number): Pick<BoardWidget['grid'], 'w' | 'h'> {
  return {
    w: spec.ratioW * scale,
    h: spec.ratioH * scale
  }
}

export function compactWidgetSummary(widget: BoardWidget): string {
  if (widget.type === 'weather') return 'Current location'
  if (widget.type === 'word_of_day') return 'Daily prompt'
  if (widget.type === 'world_clocks') {
    const count = widget.config.worldClocks?.locations?.length ?? 0
    return count > 0 ? `${count} zone${count === 1 ? '' : 's'}` : 'World time'
  }
  if (widget.type === 'countdown') return widget.config.countdown?.label?.trim() || 'Target date'
  return 'Time & date'
}

export function WidgetTypeIcon({ type }: { type: WidgetType }): ReactElement {
  const entry = widgetTypes.find((candidate) => candidate.value === type)
  const Icon = entry?.icon ?? Clock3
  return <Icon size={16} />
}

export function WidgetRenderer({ compact, widget }: { compact: boolean; widget: BoardWidget }): ReactElement {
  if (compact) return <CompactWidgetPreview widget={widget} />
  if (widget.type === 'weather') return <WeatherWidget compact={compact} widget={widget} />
  if (widget.type === 'word_of_day') return <WordOfDayWidget compact={compact} widget={widget} />
  if (widget.type === 'world_clocks') return <WorldClocksWidget compact={compact} widget={widget} />
  if (widget.type === 'countdown') return <CountdownWidget compact={compact} widget={widget} />
  return <ClockWidget compact={compact} widget={widget} />
}

export function defaultWorldClockConfig(): NonNullable<BoardWidgetConfig['worldClocks']> {
  return {
    locations: [
      { id: 'bucharest', label: 'Bucharest', timeZone: 'Europe/Bucharest' },
      { id: 'london', label: 'London', timeZone: 'Europe/London' },
      { id: 'new-york', label: 'New York', timeZone: 'America/New_York' },
      { id: 'tokyo', label: 'Tokyo', timeZone: 'Asia/Tokyo' }
    ],
    showSeconds: false,
    style: 'panel'
  }
}

export function defaultWeatherConfig(): NonNullable<BoardWidgetConfig['weather']> {
  return {
    temperatureUnit: 'celsius',
    locationMode: 'current',
    customLocation: null
  }
}

export function weatherLocationSearchError(error: unknown): string {
  if (error instanceof Error && error.message.startsWith('weather-location-http-')) {
    return 'The location service did not respond successfully. Please try again in a moment.'
  }
  if (error instanceof Error && error.message === 'weather-location-network') {
    return 'The location search service could not be reached. Check connectivity and try again.'
  }
  return 'Location search is unavailable right now. Please try again in a moment.'
}

export function defaultConfigForWidgetType(type: WidgetType): BoardWidgetConfig {
  if (type === 'weather') return { weather: defaultWeatherConfig() }
  if (type === 'word_of_day') return { wordOfDay: { accent: 'calm' } }
  if (type === 'world_clocks') return { worldClocks: defaultWorldClockConfig() }
  if (type === 'countdown') return { countdown: { label: 'Next milestone', targetAt: '', style: 'segmented' } }
  return { clock: { showSeconds: true, style: 'segmented' } }
}

function CompactWidgetPreview({ widget }: { widget: BoardWidget }): ReactElement {
  return (
    <div className="compact-widget-preview">
      <div className="compact-widget-name">{widget.name}</div>
    </div>
  )
}

function ClockWidget({ compact, widget }: { compact: boolean; widget: BoardWidget }): ReactElement {
  const now = useNow(widget.config.clock?.showSeconds ? 1000 : 60000)
  const parts = clockTimeParts(now)
  const seconds = now.toLocaleTimeString(undefined, { second: '2-digit' })
  const style = widget.config.clock?.style === 'split_date' ? 'split_date' : 'segmented'

  if (style === 'split_date') {
    return (
      <div className={`widget-content widget-digital-shell clock-style-split ${compact ? 'compact-widget' : ''}`}>
        <div className="clock-split-layout" role="presentation">
          <div className="clock-split-primary">
            <div className="segment-box segment-box-wide">
              <span className="segment-box-time-inline">
                {parts.hour}:{parts.minute}
                {widget.config.clock?.showSeconds && <small className="segment-box-seconds-inline">:{seconds}</small>}
              </span>
            </div>
          </div>
          <div className="clock-split-side">
            <span className="clock-split-weekday">{now.toLocaleDateString(undefined, { weekday: 'long' })}</span>
            <strong className="clock-split-day">{now.getDate()}</strong>
            <span className="clock-split-month">{now.toLocaleDateString(undefined, { month: 'long' })}</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`widget-content widget-digital-shell clock-style-segmented ${compact ? 'compact-widget' : ''}`}>
      <span className="widget-date-line">{formatWidgetDate(now)}</span>
      <div className="segment-box-row three" role="presentation">
        <div className="segment-box">
          <span className="segment-box-value">{parts.hour}</span>
        </div>
        <div className="segment-box">
          <span className="segment-box-value">{parts.minute}</span>
        </div>
        <div className="segment-box segment-box-meridiem">
          <span className="segment-box-value">{parts.dayPeriod}</span>
        </div>
      </div>
      {widget.config.clock?.showSeconds && <span className="widget-detail-line">Seconds {seconds}</span>}
    </div>
  )
}

function WeatherWidget({ compact, widget }: { compact: boolean; widget: BoardWidget }): ReactElement {
  const [state, setState] = useState<{ loading: boolean; kicker: string; text: string; detail: string }>({
    loading: true,
    kicker: 'Current location',
    text: 'Loading weather',
    detail: 'Requesting current location...'
  })

  useEffect(() => {
    let cancelled = false
    async function loadWeather(): Promise<void> {
      try {
        const location = await resolveWeatherLocation(widget.config.weather)
        const unit = widget.config.weather?.temperatureUnit === 'fahrenheit' ? 'fahrenheit' : 'celsius'
        const payload = await window.lpl.fetchWeatherForecast({
          latitude: location.latitude,
          longitude: location.longitude,
          temperatureUnit: unit
        })
        if (cancelled) return
        const unitSymbol = unit === 'fahrenheit' ? 'F' : 'C'
        setState({
          loading: false,
          kicker: location.kicker,
          text: `${Math.round(payload.temperature)}°${unitSymbol}`,
          detail: `${weatherCodeLabel(payload.weatherCode, payload.isDay)} · Feels like ${Math.round(payload.apparentTemperature)}°${unitSymbol}`
        })
      } catch (error) {
        if (cancelled) return
        setState({
          loading: false,
          kicker: 'Weather',
          text: 'Weather unavailable',
          detail: weatherUnavailableDetail(error)
        })
      }
    }
    void loadWeather()
    const timer = window.setInterval(() => void loadWeather(), 15 * 60 * 1000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [
    widget.config.weather?.customLocation?.label,
    widget.config.weather?.customLocation?.latitude,
    widget.config.weather?.customLocation?.longitude,
    widget.config.weather?.locationMode,
    widget.config.weather?.temperatureUnit,
    widget.id
  ])

  return (
    <div className={`widget-content weather-widget ${compact ? 'compact-widget' : ''}`}>
      <span className="widget-kicker">{state.kicker}</span>
      <strong>{state.text}</strong>
      <p>{state.loading ? 'Updating…' : state.detail}</p>
    </div>
  )
}

function WordOfDayWidget({ compact, widget }: { compact: boolean; widget: BoardWidget }): ReactElement {
  const today = new Date()
  const index = Math.floor(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()) / 86400000) % wordBank.length
  const word = wordBank[index]
  return (
    <div className={`widget-content word-widget ${compact ? 'compact-widget' : ''}`}>
      <span className="widget-kicker">Word of the day</span>
      <strong>{word.word}</strong>
      <p>{word.meaning}</p>
    </div>
  )
}

function WorldClocksWidget({ compact, widget }: { compact: boolean; widget: BoardWidget }): ReactElement {
  const now = useNow(widget.config.worldClocks?.showSeconds ? 1000 : 60000)
  const locations = widget.config.worldClocks?.locations ?? []
  return (
    <div className={`widget-content widget-digital-shell world-clocks-widget ${compact ? 'compact-widget' : ''}`}>
      {locations.map((location) => (
        <div className="world-clock-entry" key={location.id}>
          <span className="widget-date-line world-clock-location">{location.label}</span>
          <div className="segment-box world-clock-tile">
            <small className="world-clock-date-inline">{formatZonedWidgetDate(now, location.timeZone)}</small>
            <strong className="segment-box-value world-clock-time">
              {new Intl.DateTimeFormat(undefined, {
                hour: '2-digit',
                minute: '2-digit',
                hour12: false,
                timeZone: location.timeZone
              }).format(now)}
            </strong>
          </div>
          <span className="widget-detail-line world-clock-weekday">{formatZonedWeekday(now, location.timeZone)}</span>
        </div>
      ))}
    </div>
  )
}

function CountdownWidget({ compact, widget }: { compact: boolean; widget: BoardWidget }): ReactElement {
  const now = useNow(1000)
  const targetText = widget.config.countdown?.targetAt ?? ''
  const label = widget.config.countdown?.label?.trim() || 'Next milestone'
  const target = targetText ? new Date(targetText) : null
  const validTarget = target && !Number.isNaN(target.getTime()) ? target : null

  if (!validTarget) {
    return (
      <div className={`widget-content countdown-widget ${compact ? 'compact-widget' : ''}`}>
        <span className="widget-kicker">{label}</span>
        <strong>No target set</strong>
        <p>Add a date and time in widget settings.</p>
      </div>
    )
  }

  const diff = validTarget.getTime() - now.getTime()
  const absolute = Math.abs(diff)
  const totalMinutes = Math.floor(absolute / 60000)
  const days = Math.floor(totalMinutes / (60 * 24))
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60)
  const minutes = totalMinutes % 60
  const seconds = Math.floor((absolute % 60000) / 1000)

  return (
    <div className={`widget-content widget-digital-shell countdown-widget ${compact ? 'compact-widget' : ''}`}>
      <span className="widget-kicker">{label}</span>
      <div className="segment-box-row four">
        <div className="segment-box">
          <span className="segment-box-value">{String(days).padStart(2, '0')}</span>
        </div>
        <div className="segment-box">
          <span className="segment-box-value">{String(hours).padStart(2, '0')}</span>
        </div>
        <div className="segment-box">
          <span className="segment-box-value">{String(minutes).padStart(2, '0')}</span>
        </div>
        <div className="segment-box">
          <span className="segment-box-value">{String(seconds).padStart(2, '0')}</span>
        </div>
      </div>
      <div className="segment-box-label-row four">
        <span>Days</span>
        <span>Hours</span>
        <span>Minutes</span>
        <span>Seconds</span>
      </div>
    </div>
  )
}

function clockTimeParts(date: Date): { hour: string; minute: string; dayPeriod: string } {
  const parts = new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  }).formatToParts(date)
  return {
    hour: parts.find((part) => part.type === 'hour')?.value ?? '00',
    minute: parts.find((part) => part.type === 'minute')?.value ?? '00',
    dayPeriod: (parts.find((part) => part.type === 'dayPeriod')?.value ?? 'AM').toUpperCase()
  }
}

function formatWidgetDate(date: Date): string {
  const weekday = date.toLocaleDateString(undefined, { weekday: 'long' })
  const month = date.toLocaleDateString(undefined, { month: 'long' })
  const year = date.getFullYear()
  return `${weekday}, ${month} ${ordinalDay(date.getDate())}, ${year}`
}

function ordinalDay(day: number): string {
  const mod100 = day % 100
  if (mod100 >= 11 && mod100 <= 13) return `${day}th`
  const mod10 = day % 10
  if (mod10 === 1) return `${day}st`
  if (mod10 === 2) return `${day}nd`
  if (mod10 === 3) return `${day}rd`
  return `${day}th`
}

function formatZonedWeekday(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    timeZone
  }).format(date)
}

function formatZonedWidgetDate(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    timeZone
  }).formatToParts(date)
  const month = parts.find((part) => part.type === 'month')?.value ?? ''
  const day = Number(parts.find((part) => part.type === 'day')?.value ?? '1')
  return `${month} ${ordinalDay(day)}`
}

function useNow(intervalMs: number): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), intervalMs)
    return () => window.clearInterval(timer)
  }, [intervalMs])
  return now
}

function weatherCodeLabel(code: number, isDay: boolean): string {
  if (code === 0) return isDay ? 'Clear sky' : 'Clear night'
  if (code === 1 || code === 2) return 'Partly cloudy'
  if (code === 3) return 'Overcast'
  if (code === 45 || code === 48) return 'Fog'
  if (code >= 51 && code <= 67) return 'Rain'
  if (code >= 71 && code <= 77) return 'Snow'
  if (code >= 80 && code <= 82) return 'Showers'
  if (code >= 95) return 'Storms'
  return 'Weather update'
}

async function requestWeatherPosition(): Promise<GeolocationPosition> {
  if (!('geolocation' in navigator)) throw new Error('geolocation-unsupported')
  return new Promise<GeolocationPosition>((resolve, reject) =>
    navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: false, timeout: 10000, maximumAge: 15 * 60 * 1000 })
  )
}

async function resolveWeatherLocation(
  config: BoardWidgetConfig['weather'] | undefined
): Promise<{ latitude: number; longitude: number; kicker: string }> {
  if (config?.locationMode === 'custom' && config.customLocation) {
    return {
      latitude: config.customLocation.latitude,
      longitude: config.customLocation.longitude,
      kicker: config.customLocation.label
    }
  }
  try {
    const position = await requestWeatherPosition()
    return {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      kicker: 'Current location'
    }
  } catch (error) {
    return requestApproximateWeatherLocation(error)
  }
}

async function requestApproximateWeatherLocation(previousError: unknown): Promise<WeatherApproximateLocation> {
  try {
    return await window.lpl.fetchWeatherApproximateLocation()
  } catch (error) {
    throw error ?? previousError
  }
}

function weatherUnavailableDetail(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = Number((error as { code?: unknown }).code)
    if (code === 1) return 'Location access is blocked and approximate lookup was unavailable. Check permissions or connectivity and try again.'
    if (code === 2) return 'Current location could not be determined and approximate lookup was unavailable. Check location services and try again.'
    if (code === 3) return 'Location lookup timed out and approximate lookup was unavailable. Check connectivity and try again.'
  }
  if (error instanceof Error && error.message.startsWith('weather-http-')) {
    return 'The weather service did not respond successfully. Please try again in a moment.'
  }
  if (error instanceof Error && (error.message.startsWith('ip-location-http-') || error.message === 'ip-location-network')) {
    return 'Approximate location lookup failed. Check connectivity and try again.'
  }
  if (error instanceof Error && (error.message === 'weather-network' || error.message === 'weather-missing')) {
    return 'The weather service could not be reached. Check connectivity and try again.'
  }
  if (error instanceof TypeError) {
    return 'The weather location service could not be reached. Check connectivity and try again.'
  }
  return 'Location permission or weather service unavailable.'
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

const wordBank = [
  { word: 'Steady', meaning: 'Move with calm consistency, even when the day is noisy.' },
  { word: 'Clarity', meaning: 'Let the next right thing matter more than everything at once.' },
  { word: 'Gentle', meaning: 'A softer pace can still carry real momentum.' },
  { word: 'Resolve', meaning: 'Commit quietly, then keep going.' },
  { word: 'Balance', meaning: 'Make room for what restores you, not only what demands you.' },
  { word: 'Focus', meaning: 'Protect attention like a finite resource.' },
  { word: 'Courage', meaning: 'Small brave actions count more than perfect plans.' }
]
