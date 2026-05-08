import { Plus, Save, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { FormEvent, ReactElement } from 'react'
import type { AppSettings, BoardList, BoardSnapshot, GroupSummaryConfig, GroupSummaryMethod, ItemGroup, ListColumn } from '@shared/domain'
import { EditorHeading } from './chrome'
import { ItemEditorPanel, type ItemEditorPanelProps } from './itemEditor'

type RunAction = (action: () => Promise<any>) => Promise<any>

type GroupEditorPanelProps = {
  appSettings: AppSettings
  busy: boolean
  group: ItemGroup
  itemEditorHelpers: ItemEditorPanelProps['helpers']
  list: BoardList
  runAction: RunAction
  snapshot: BoardSnapshot
  visibleColumns: (list: BoardList) => ListColumn[]
}

export function GroupEditorPanel({
  appSettings,
  busy,
  group,
  itemEditorHelpers,
  list,
  runAction,
  snapshot,
  visibleColumns
}: GroupEditorPanelProps): ReactElement {
  const [name, setName] = useState(group.name)
  const [showIdOnBoard, setShowIdOnBoard] = useState(group.showIdOnBoard)
  const [summaries, setSummaries] = useState<GroupSummaryConfig[]>(group.summaries)
  const [showCreateItemModal, setShowCreateItemModal] = useState(false)

  useEffect(() => {
    setName(group.name)
    setShowIdOnBoard(group.showIdOnBoard)
    setSummaries(group.summaries)
  }, [group.id, group.name, group.showIdOnBoard, group.summaries])

  function submit(event: FormEvent): void {
    event.preventDefault()
    runAction(() => window.lpl.updateGroup({ groupId: group.id, parentGroupId: group.parentGroupId, name, showIdOnBoard, summaries }))
  }

  function setSummary(columnId: string, method: GroupSummaryMethod | ''): void {
    setSummaries((current) => {
      const next = current.filter((summary) => summary.columnId !== columnId)
      return method ? [...next, { columnId, method }] : next
    })
  }

  function summaryMethod(columnId: string): GroupSummaryMethod | '' {
    return summaries.find((summary) => summary.columnId === columnId)?.method ?? ''
  }

  return (
    <form className="editor-card" onSubmit={submit}>
      <EditorHeading eyebrow="Group" title={group.name} />
      <div className="field-grid two">
        <label>
          <span>Group name</span>
          <input onChange={(event) => setName(event.target.value)} required value={name} />
        </label>
        <label className="toggle-field">
          <input checked={showIdOnBoard} onChange={(event) => setShowIdOnBoard(event.target.checked)} type="checkbox" />
          <span>Show group ID</span>
        </label>
      </div>
      <section className="inline-config-panel">
        <EditorHeading eyebrow="Display" title="Group Row Summaries" />
        <div className="summary-config-list">
          {visibleColumns(list).map((column) => (
            <label className="summary-config-row" key={column.id}>
              <span>{column.name}</span>
              <select onChange={(event) => setSummary(column.id, event.target.value as GroupSummaryMethod | '')} value={summaryMethod(column.id)}>
                <option value="">Hide</option>
                <option value="sum">Sum</option>
                <option value="max">Max</option>
                <option value="avg">Avg</option>
                <option value="count"># of items</option>
              </select>
            </label>
          ))}
        </div>
      </section>
      <div className="form-actions">
        <button className="icon-button" onClick={() => setShowCreateItemModal(true)} type="button">
          <Plus size={16} />
          Add Item
        </button>
        <button className="danger-button" onClick={() => runAction(() => window.lpl.deleteGroup(group.id))} type="button">
          <Trash2 size={16} />
          Delete Group
        </button>
        <button className="primary-button" type="submit">
          <Save size={16} />
          Save Group
        </button>
      </div>
      {showCreateItemModal && (
        <ItemEditorPanel
          appSettings={appSettings}
          busy={busy}
          helpers={itemEditorHelpers}
          initialGroupId={group.id}
          item={null}
          list={list}
          mode="create"
          onClose={() => setShowCreateItemModal(false)}
          presentation="modal"
          runAction={runAction}
          snapshot={snapshot}
        />
      )}
    </form>
  )
}
