import type { ReactElement } from 'react'
import type {
  CurrencyCode,
  DateFieldValue,
  DateDisplayFormat,
  FieldValue,
  ListColumn,
  RecurrenceMode
} from '@shared/domain'

export const weekdayLabels = [
  { short: 'S', long: 'Sun' },
  { short: 'M', long: 'Mon' },
  { short: 'T', long: 'Tue' },
  { short: 'W', long: 'Wed' },
  { short: 'T', long: 'Thu' },
  { short: 'F', long: 'Fri' },
  { short: 'S', long: 'Sat' }
]

export function inputType(column: ListColumn): string {
  if (column.role === 'deadline') return column.dateDisplayFormat === 'datetime' ? 'datetime-local' : 'date'
  if (column.type === 'date') {
    if (column.dateDisplayFormat === 'datetime') return 'datetime-local'
    if (column.dateDisplayFormat === 'time') return 'time'
    return 'date'
  }
  if (column.type === 'hyperlink') return 'url'
  if (column.type === 'duration') return 'text'
  if (column.type === 'integer' || column.type === 'decimal' || column.type === 'currency') return 'number'
  return 'text'
}

export function inputValue(value: FieldValue | undefined, column: ListColumn): string {
  if (value === null || value === undefined || Array.isArray(value)) return ''
  if (isDateFieldValue(value)) return inputValue(value.value, column)
  if (column.type === 'duration' && typeof value === 'number') return durationInputValue(value)
  if (column.role === 'deadline' && typeof value === 'string') {
    if (column.dateDisplayFormat === 'datetime' && value.length === 10) return `${value}T00:00`
    if (column.dateDisplayFormat === 'date' && value.includes('T')) return value.slice(0, 10)
  }
  if (column.type === 'date' && typeof value === 'string') {
    if (column.dateDisplayFormat === 'datetime' && value.length === 10) return `${value}T00:00`
    if (column.dateDisplayFormat === 'date' && value.includes('T')) return value.slice(0, 10)
    if (column.dateDisplayFormat === 'time') return value.includes('T') ? value.slice(11, 16) : value.slice(0, 5)
  }
  return String(value)
}

export function choiceInputValue(value: FieldValue | undefined, column: ListColumn): string | string[] {
  if (column.choiceConfig?.selection === 'multi') return Array.isArray(value) ? value : value ? [String(value)] : []
  return Array.isArray(value) ? (value[0] ?? '') : value ? String(value) : ''
}

export function coerceInputValue(column: ListColumn, value: FieldValue): FieldValue {
  if (isDateFieldValue(value)) return value.value ? value : null
  if (column.type === 'boolean') return Boolean(value)
  if (column.type === 'choice') return value === '' ? null : value
  if (column.type === 'duration') {
    if (value === null || value === '') return null
    if (typeof value === 'number') return Number.isFinite(value) ? Math.max(0, Math.round(value)) : Number.NaN
    return parseDurationInput(String(value))
  }
  if (value === '') return null
  if (column.type === 'integer') return Number.parseInt(String(value), 10)
  if (column.type === 'decimal' || column.type === 'currency') return Number.parseFloat(String(value))
  return String(value)
}

export function parseDurationInput(value: string): number | null {
  const trimmed = value.trim().toLowerCase()
  if (!trimmed) return null
  const hourMatch = trimmed.match(/^(\d+(?:\.\d+)?)\s*h$/)
  if (hourMatch) return Math.round(Number(hourMatch[1]) * 60)
  const parts = trimmed.split(':').map((part) => part.trim())
  if (parts.length === 2) {
    const hours = Number(parts[0])
    const minutes = Number(parts[1])
    if (Number.isFinite(hours) && Number.isFinite(minutes) && minutes >= 0 && minutes < 60) return Math.round(hours * 60 + minutes)
  }
  if (/^\d+(?:\.\d+)?$/.test(trimmed)) return Math.round(Number(trimmed) * 60)
  return Number.NaN
}

export function durationDraftFromMinutes(minutes: number | null): { hours: string; minutes: string } {
  if (minutes === null || !Number.isFinite(minutes)) return { hours: '', minutes: '' }
  const totalMinutes = Math.max(0, Math.round(minutes))
  const totalHours = Math.floor(totalMinutes / 60)
  const remainderMinutes = totalMinutes % 60
  return {
    hours: totalHours > 0 ? String(totalHours) : '',
    minutes: remainderMinutes > 0 ? String(remainderMinutes).padStart(2, '0') : ''
  }
}

export function sanitizeDurationPart(value: string): string {
  return value.replace(/[^\d]/g, '')
}

export function durationMinutesFromDraft(hours: string, minutes: string): number | null {
  if (!hours.trim() && !minutes.trim()) return null
  const safeHours = Number.parseInt(hours || '0', 10)
  const safeMinutes = Number.parseInt(minutes || '0', 10)
  if (![safeHours, safeMinutes].every((value) => Number.isFinite(value) && value >= 0)) return Number.NaN
  return safeHours * 60 + safeMinutes
}

export function durationInputValue(minutes: number): string {
  if (!Number.isFinite(minutes)) return ''
  const totalMinutes = Math.max(0, Math.round(minutes))
  const hours = Math.floor(totalMinutes / 60)
  const remainderMinutes = totalMinutes % 60
  return `${hours}:${String(remainderMinutes).padStart(2, '0')}`
}

export function formatDurationMinutes(minutes: number): string {
  if (!Number.isFinite(minutes)) return '-'
  const totalMinutes = Math.max(0, Math.round(minutes))
  const hours = Math.floor(totalMinutes / 60)
  const mins = totalMinutes % 60
  return `${hours}h ${mins}min`
}

export function formatValue(value: FieldValue | undefined, column: ListColumn): string {
  if (isDateFieldValue(value)) {
    if (!value.value) return '-'
    if (column.type === 'date' && column.dateDisplayFormat === 'time') {
      return recurrenceLabel(value.recurrence, value.recurrenceDays, formatTimeValue(value.value), value.recurrenceInterval)
    }
    return formatValue(value.value, column)
  }
  if (Array.isArray(value)) {
    return value.map((entry) => choiceLabel(entry, column)).join(', ')
  }
  if (value === null || value === undefined || value === '') return '-'
  if (column.type === 'choice') return choiceLabel(String(value), column)
  if (column.type === 'boolean') return value ? 'Yes' : 'No'
  if (column.type === 'currency' && typeof value === 'number') {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: column.currencyCode }).format(value)
  }
  if (column.type === 'duration' && typeof value === 'number') return formatDurationMinutes(value)
  if (normalizeColumnName(column.name) === '% done' && typeof value === 'number') return `${value}%`
  if (column.type === 'date' && typeof value === 'string') {
    if (column.dateDisplayFormat === 'datetime') return formatDateTimeValue(value)
    if (column.dateDisplayFormat === 'time') {
      return formatTimeValue(value)
    }
    return formatDateValue(value)
  }
  return String(value)
}

export function formatDateValue(value: string): string {
  if (!value.includes('T') && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(`${value}T00:00:00`))
  }
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value))
}

export function formatDateTimeValue(value: string): string {
  if (!value.includes('T') && /^\d{4}-\d{2}-\d{2}$/.test(value)) return formatDateValue(value)
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

export function formatSystemDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

export function formatTimeValue(value: string): string {
  const candidate = value.includes('T') ? value : `1970-01-01T${value}`
  return new Intl.DateTimeFormat(undefined, { timeStyle: 'short' }).format(new Date(candidate))
}

export function isDateFieldValue(value: FieldValue | undefined): value is DateFieldValue {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value) && 'value' in value)
}

export function dateFieldValue(value: FieldValue | undefined): DateFieldValue {
  if (isDateFieldValue(value)) {
    const recurrence = value.recurrence ?? 'none'
    return {
      value: value.value,
      recurrence,
      recurrenceDays: recurrenceNeedsWeekdays(recurrence) ? normalizeRecurrenceDays(value.recurrenceDays) : [],
      recurrenceInterval: normalizeRecurrenceInterval(value.recurrenceInterval)
    }
  }
  return {
    value: typeof value === 'string' ? value : '',
    recurrence: 'none',
    recurrenceDays: [],
    recurrenceInterval: 1
  }
}

export function isItemLevelRecurringTimeColumn(column: ListColumn): boolean {
  return column.type === 'date' && column.role !== 'deadline' && column.dateDisplayFormat === 'time'
}

export function recurrenceLabel(recurrence: RecurrenceMode, days: number[], time: string, interval = 1): string {
  if (recurrence === 'daily') return `Daily, ${time}`
  if (recurrence === 'weekly') return `${daysLabel(days, 'Weekly')}, ${time}`
  if (recurrence === 'interval_weeks') return `${daysLabel(days, `Every ${normalizeRecurrenceInterval(interval)} weeks`)}, ${time}`
  if (recurrence === 'monthly') return `Monthly, ${time}`
  if (recurrence === 'interval_months') return `Every ${normalizeRecurrenceInterval(interval)} months, ${time}`
  if (recurrence === 'custom_weekdays') return `${daysLabel(days, 'Selected days')}, ${time}`
  return time
}

export function daysLabel(days: number[], fallback: string): string {
  if (days.length === 0) return fallback
  return days.map((day) => weekdayLabels[day]?.long).filter(Boolean).join(', ')
}

export function recurrenceNeedsWeekdays(recurrence: RecurrenceMode): boolean {
  return recurrence === 'weekly' || recurrence === 'interval_weeks' || recurrence === 'custom_weekdays'
}

export function recurrenceNeedsInterval(recurrence: RecurrenceMode): boolean {
  return recurrence === 'interval_weeks' || recurrence === 'interval_months'
}

export function normalizeRecurrenceDays(days: number[] | undefined): number[] {
  return [...new Set((days ?? []).map((day) => Math.trunc(day)).filter((day) => day >= 0 && day <= 6))].sort((a, b) => a - b)
}

export function normalizeRecurrenceInterval(interval: number | undefined): number {
  return Number.isFinite(interval) ? Math.max(1, Math.min(24, Math.trunc(interval ?? 1))) : 1
}

export function formatCellValue(value: FieldValue | undefined, column: ListColumn): string | ReactElement {
  if (column.type !== 'hyperlink') return formatValue(value, column)
  const label = formatValue(value, column)
  if (label === '-') return label
  return (
    <button
      className="link-cell-button"
      onClick={(event) => {
        event.stopPropagation()
        window.lpl.openExternalUrl(label)
      }}
      type="button"
    >
      {linkLabel(label)}
    </button>
  )
}

export function linkLabel(value: string): string {
  try {
    const url = new URL(value.startsWith('http://') || value.startsWith('https://') ? value : `https://${value}`)
    return url.hostname.replace(/^www\./, '') || value
  } catch {
    return value
  }
}

export function choiceLabel(value: string, column: ListColumn): string {
  return column.choiceConfig?.options.find((option) => option.id === value || option.label === value)?.label ?? value
}

function normalizeColumnName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ')
}
