import { Globe2, Plus, Save, Trash2 } from 'lucide-react'
import { FormEvent, useEffect, useState } from 'react'
import type { Dispatch, ReactElement, SetStateAction } from 'react'
import type {
  BoardSnapshot,
  BoardWidget,
  BoardWidgetConfig,
  WeatherLocationSearchResult,
  WidgetType
} from '@shared/domain'
import type { RunAction, SelectedNode } from '../app/types'
import { EditorHeading } from '../editors/chrome'
import { MessageModal } from '../modals/dialogs'

export type WidgetEditorHelpers = {
  canPlaceWidgetGrid: (
    grid: BoardWidget['grid'],
    lists: BoardSnapshot['lists'],
    widgets: BoardSnapshot['widgets'],
    currentWidgetId: string,
    type: WidgetType,
    config: BoardWidgetConfig
  ) => boolean
  defaultConfigForWidgetType: (type: WidgetType) => BoardWidgetConfig
  defaultWeatherConfig: () => NonNullable<BoardWidgetConfig['weather']>
  defaultWorldClockConfig: () => NonNullable<BoardWidgetConfig['worldClocks']>
  normalizeWidgetDisplayGrid: (grid: BoardWidget['grid'], type: WidgetType, config: BoardWidgetConfig) => BoardWidget['grid']
  weatherLocationSearchError: (error: unknown) => string
  widgetTypes: Array<{ value: WidgetType; label: string }>
  wizardWidgetLayoutOptions: Record<WidgetType, string[]>
  worldClockTimeZones: string[]
}

export function WidgetEditorPanel({
  helpers,
  runAction,
  setSelectedNode,
  snapshot,
  widget
}: {
  helpers: WidgetEditorHelpers
  runAction: RunAction
  setSelectedNode: Dispatch<SetStateAction<SelectedNode | null>>
  snapshot: BoardSnapshot
  widget: BoardWidget
}): ReactElement {
  const [name, setName] = useState(widget.name)
  const [displayEnabled, setDisplayEnabled] = useState(widget.displayEnabled)
  const [grid, setGrid] = useState(widget.grid)
  const [type, setType] = useState<WidgetType>(widget.type)
  const [config, setConfig] = useState<BoardWidgetConfig>(widget.config)
  const [weatherSearchQuery, setWeatherSearchQuery] = useState('')
  const [weatherSearchResults, setWeatherSearchResults] = useState<WeatherLocationSearchResult[]>([])
  const [weatherSelectedResultId, setWeatherSelectedResultId] = useState('')
  const [weatherSearchBusy, setWeatherSearchBusy] = useState(false)
  const [messageDialog, setMessageDialog] = useState<{ title: string; message: string } | null>(null)

  useEffect(() => {
    setName(widget.name)
    setDisplayEnabled(widget.displayEnabled)
    setGrid(widget.grid)
    setType(widget.type)
    setConfig(widget.config)
    setWeatherSearchQuery(widget.config.weather?.customLocation?.label ?? '')
    setWeatherSearchResults([])
    setWeatherSelectedResultId('')
    setWeatherSearchBusy(false)
  }, [widget.id])

  function submit(event: FormEvent): void {
    event.preventDefault()
    const nextGrid = displayEnabled ? helpers.normalizeWidgetDisplayGrid(grid, type, config) : { x: 0, y: 0, w: 0, h: 0 }
    if (displayEnabled && !helpers.canPlaceWidgetGrid(nextGrid, snapshot.lists, snapshot.widgets, widget.id, type, config)) {
      setMessageDialog({
        title: 'Widget Placement Conflict',
        message: 'This widget overlaps another visible board element. Move or resize it first.'
      })
      return
    }
    void runAction(() =>
      window.lpl.updateWidget({
        widgetId: widget.id,
        type,
        name,
        displayEnabled,
        grid: nextGrid,
        config
      })
    )
  }

  function updateWorldClockConfig(updater: (current: NonNullable<BoardWidgetConfig['worldClocks']>) => NonNullable<BoardWidgetConfig['worldClocks']>): void {
    setConfig((current) => {
      const nextWorldClocks = updater(current.worldClocks ?? helpers.defaultWorldClockConfig())
      const nextConfig = { worldClocks: nextWorldClocks }
      setGrid((currentGrid) => helpers.normalizeWidgetDisplayGrid(currentGrid, 'world_clocks', nextConfig))
      return nextConfig
    })
  }

  function addWorldClock(): void {
    updateWorldClockConfig((current) => {
      if (current.locations.length >= 16) return current
      const id = `clock-${crypto.randomUUID?.() ?? Date.now().toString(36)}`
      return {
        ...current,
        locations: [...current.locations, { id, label: 'New Clock', timeZone: 'UTC' }]
      }
    })
  }

  function removeWorldClock(locationId: string): void {
    updateWorldClockConfig((current) => {
      if (current.locations.length <= 2) return current
      return {
        ...current,
        locations: current.locations.filter((location) => location.id !== locationId)
      }
    })
  }

  function updateWeatherConfig(updater: (current: NonNullable<BoardWidgetConfig['weather']>) => NonNullable<BoardWidgetConfig['weather']>): void {
    setConfig((current) => ({
      weather: updater(current.weather ?? helpers.defaultWeatherConfig())
    }))
  }

  async function searchCustomWeatherLocations(): Promise<void> {
    const query = weatherSearchQuery.trim()
    if (query.length < 2) {
      setMessageDialog({
        title: 'Search Location',
        message: 'Please enter at least 2 characters to search for a weather location.'
      })
      return
    }
    setWeatherSearchBusy(true)
    try {
      const results = await window.lpl.searchWeatherLocations(query)
      setWeatherSearchResults(results)
      if (results.length === 1) {
        const match = results[0]
        setWeatherSelectedResultId(match.id)
        updateWeatherConfig((current) => ({
          ...current,
          locationMode: 'custom',
          customLocation: {
            label: match.label,
            latitude: match.latitude,
            longitude: match.longitude
          }
        }))
        setWeatherSearchQuery(match.label)
      }
    } catch (error) {
      setMessageDialog({
        title: 'Weather Location Search',
        message: helpers.weatherLocationSearchError(error)
      })
    } finally {
      setWeatherSearchBusy(false)
    }
  }

  function applyWeatherSearchResult(id: string): void {
    const match = weatherSearchResults.find((entry) => entry.id === id)
    if (!match) return
    setWeatherSelectedResultId(id)
    updateWeatherConfig((current) => ({
      ...current,
      locationMode: 'custom',
      customLocation: {
        label: match.label,
        latitude: match.latitude,
        longitude: match.longitude
      }
    }))
    setWeatherSearchQuery(match.label)
  }

  function widgetLayoutValue(): string {
    if (type === 'clock') return config.clock?.style === 'split_date' ? 'Split Date' : 'Segmented'
    if (type === 'countdown') return 'Segmented'
    if (type === 'world_clocks') return 'Panel'
    return 'Default'
  }

  function applyWidgetLayout(layout: string): void {
    if (type === 'clock') {
      setConfig((current) => ({
        clock: {
          showSeconds: current.clock?.showSeconds !== false,
          style: layout === 'Split Date' ? 'split_date' : 'segmented'
        }
      }))
      return
    }
    if (type === 'countdown') {
      setConfig((current) => ({
        countdown: {
          label: current.countdown?.label ?? 'Next milestone',
          targetAt: current.countdown?.targetAt ?? '',
          style: 'segmented'
        }
      }))
      return
    }
    if (type !== 'world_clocks') return
    updateWorldClockConfig((current) => ({
      ...current,
      style: 'panel'
    }))
  }

  const currentWidgetLabel = helpers.widgetTypes.find((entry) => entry.value === type)?.label ?? 'Widget'

  return (
    <form className="editor-card" onSubmit={submit}>
      <EditorHeading eyebrow="Widget" title={widget.name} />
      <div className="field-grid two">
        <label>
          <span>Widget name</span>
          <input autoFocus={widget.name === 'New Widget'} onChange={(event) => setName(event.target.value)} required value={name} />
        </label>
        <label>
          <span>Widget type</span>
          <select
            onChange={(event) => {
              const nextType = event.target.value as WidgetType
              const nextConfig = helpers.defaultConfigForWidgetType(nextType)
              setType(nextType)
              setConfig(nextConfig)
              setGrid((current) => helpers.normalizeWidgetDisplayGrid(current, nextType, nextConfig))
              if (name === 'New Widget' || name === helpers.widgetTypes.find((entry) => entry.value === type)?.label) {
                setName(helpers.widgetTypes.find((entry) => entry.value === nextType)?.label ?? 'Widget')
              }
            }}
            value={type}
          >
            {helpers.widgetTypes.map((widgetType) => (
              <option key={widgetType.value} value={widgetType.value}>
                {widgetType.label}
              </option>
            ))}
          </select>
        </label>
        <label className="toggle-field">
          <input checked={displayEnabled} onChange={(event) => setDisplayEnabled(event.target.checked)} type="checkbox" />
          <span>Show widget on board</span>
        </label>
        <label>
          <span>Display style</span>
          <select onChange={(event) => applyWidgetLayout(event.target.value)} value={widgetLayoutValue()}>
            {helpers.wizardWidgetLayoutOptions[type].map((layout) => (
              <option key={layout} value={layout}>
                {layout}
              </option>
            ))}
          </select>
        </label>
        <div className="geometry-row widget-geometry-row">
          {(['w', 'h', 'x', 'y'] as const).map((key) => (
            <label key={key}>
              <span>Grid {key.toUpperCase()}</span>
              <input max={key === 'x' || key === 'w' ? 16 : 8} min={key === 'w' || key === 'h' ? 2 : 1} onChange={(event) => setGrid((current) => ({ ...current, [key]: Number(event.target.value) }))} type="number" value={grid[key]} />
            </label>
          ))}
        </div>
      </div>

      <section className="inline-config-panel">
        <EditorHeading eyebrow="Configuration" title={currentWidgetLabel} />
        {type === 'clock' && (
          <label className="toggle-field">
            <input
              checked={config.clock?.showSeconds !== false}
              onChange={(event) =>
                setConfig({
                  clock: {
                    showSeconds: event.target.checked,
                    style: config.clock?.style === 'split_date' ? 'split_date' : 'segmented'
                  }
                })
              }
              type="checkbox"
            />
            <span>Show seconds</span>
          </label>
        )}
        {type === 'weather' && (
          <div className="field-grid two weather-config-panel">
            <label>
              <span>Temperature unit</span>
              <select
                onChange={(event) =>
                  updateWeatherConfig((current) => ({
                    ...current,
                    temperatureUnit: event.target.value === 'fahrenheit' ? 'fahrenheit' : 'celsius'
                  }))
                }
                value={config.weather?.temperatureUnit ?? 'celsius'}
              >
                <option value="celsius">Celsius</option>
                <option value="fahrenheit">Fahrenheit</option>
              </select>
            </label>
            <label>
              <span>Location source</span>
              <select
                onChange={(event) =>
                  updateWeatherConfig((current) => ({
                    ...current,
                    locationMode: event.target.value === 'custom' ? 'custom' : 'current',
                    customLocation: event.target.value === 'custom' ? current.customLocation : null
                  }))
                }
                value={config.weather?.locationMode ?? 'current'}
              >
                <option value="current">Current location</option>
                <option value="custom">Custom location</option>
              </select>
            </label>
            {config.weather?.locationMode === 'custom' && (
              <>
                <label className="weather-search-field">
                  <span>Search location</span>
                  <input
                    onChange={(event) => setWeatherSearchQuery(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault()
                        void searchCustomWeatherLocations()
                      }
                    }}
                    placeholder="Search city or region"
                    value={weatherSearchQuery}
                  />
                </label>
                <button className="icon-button" disabled={weatherSearchBusy} onClick={() => void searchCustomWeatherLocations()} type="button">
                  <Globe2 size={16} />
                  {weatherSearchBusy ? 'Searching…' : 'Search'}
                </button>
                <label className="weather-search-results">
                  <span>Matching locations</span>
                  <select onChange={(event) => applyWeatherSearchResult(event.target.value)} value={weatherSelectedResultId}>
                    <option value="">Select location…</option>
                    {weatherSearchResults.map((result) => (
                      <option key={result.id} value={result.id}>
                        {result.label}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="weather-selected-location">
                  <span>Selected</span>
                  <strong>{config.weather?.customLocation?.label ?? 'No custom location selected yet'}</strong>
                </div>
              </>
            )}
          </div>
        )}
        {type === 'word_of_day' && (
          <label>
            <span>Accent mood</span>
            <input onChange={(event) => setConfig({ wordOfDay: { accent: event.target.value } })} value={config.wordOfDay?.accent ?? 'calm'} />
          </label>
        )}
        {type === 'world_clocks' && (
          <div className="world-clock-config">
            <datalist id="world-clock-timezones">
              {helpers.worldClockTimeZones.map((timeZone) => (
                <option key={timeZone} value={timeZone} />
              ))}
            </datalist>
            <label className="toggle-field">
              <input checked={Boolean(config.worldClocks?.showSeconds)} onChange={(event) => updateWorldClockConfig((current) => ({ ...current, showSeconds: event.target.checked }))} type="checkbox" />
              <span>Show seconds</span>
            </label>
            {(config.worldClocks?.locations ?? helpers.defaultWorldClockConfig().locations).map((location) => (
              <div className="world-clock-config-row" key={location.id}>
                <input
                  onChange={(event) =>
                    updateWorldClockConfig((current) => ({
                      ...current,
                      locations: current.locations.map((candidate) => (candidate.id === location.id ? { ...candidate, label: event.target.value } : candidate))
                    }))
                  }
                  placeholder="Label"
                  value={location.label}
                />
                <input
                  list="world-clock-timezones"
                  onChange={(event) =>
                    updateWorldClockConfig((current) => ({
                      ...current,
                      locations: current.locations.map((candidate) => (candidate.id === location.id ? { ...candidate, timeZone: event.target.value } : candidate))
                    }))
                  }
                  placeholder="Time zone"
                  value={location.timeZone}
                />
                <button
                  className="icon-button compact-icon-button danger-subtle-button"
                  disabled={(config.worldClocks?.locations ?? helpers.defaultWorldClockConfig().locations).length <= 2}
                  onClick={() => removeWorldClock(location.id)}
                  title="Remove clock"
                  type="button"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            <button className="icon-button compact-icon-button" disabled={(config.worldClocks?.locations ?? helpers.defaultWorldClockConfig().locations).length >= 16} onClick={addWorldClock} type="button">
              <Plus size={14} />
              Add Clock
            </button>
          </div>
        )}
        {type === 'countdown' && (
          <div className="field-grid two">
            <label>
              <span>Countdown label</span>
              <input onChange={(event) => setConfig({ countdown: { label: event.target.value, targetAt: config.countdown?.targetAt ?? '', style: 'segmented' } })} value={config.countdown?.label ?? 'Next milestone'} />
            </label>
            <label>
              <span>Target date & time</span>
              <input onChange={(event) => setConfig({ countdown: { label: config.countdown?.label ?? 'Next milestone', targetAt: event.target.value, style: 'segmented' } })} type="datetime-local" value={config.countdown?.targetAt ?? ''} />
            </label>
          </div>
        )}
      </section>

      <div className="form-actions">
        <button
          className="danger-button"
          onClick={async () => {
            await runAction(() => window.lpl.deleteWidget(widget.id))
            setSelectedNode({ kind: 'board', id: snapshot.id })
          }}
          type="button"
        >
          <Trash2 size={16} />
          Delete Widget
        </button>
        <button className="primary-button" type="submit">
          <Save size={16} />
          Save Widget
        </button>
      </div>
      {messageDialog && <MessageModal title={messageDialog.title} message={messageDialog.message} onClose={() => setMessageDialog(null)} />}
    </form>
  )
}
