import { Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { ReactElement } from 'react'
import type { BoardSummary, ListTemplateType } from '@shared/domain'

export function PromptModal({
  busy,
  confirmLabel = 'Save',
  initialValue,
  label,
  onCancel,
  onConfirm,
  title
}: {
  busy: boolean
  confirmLabel?: string
  initialValue: string
  label: string
  onCancel: () => void
  onConfirm: (value: string) => void | Promise<void>
  title: string
}): ReactElement {
  const [value, setValue] = useState(initialValue)

  useEffect(() => {
    setValue(initialValue)
  }, [initialValue])

  return (
    <div className="modal-backdrop" onClick={onCancel} role="presentation">
      <div aria-modal="true" className="modal-card message-modal" onClick={(event) => event.stopPropagation()} role="dialog">
        <div className="modal-header">
          <div>
            <p className="eyebrow">Edit</p>
            <h3>{title}</h3>
          </div>
        </div>
        <div className="modal-body">
          <label className="modal-field">
            <span>{label}</span>
            <input autoFocus onChange={(event) => setValue(event.target.value)} value={value} />
          </label>
        </div>
        <div className="modal-actions">
          <button className="icon-button" disabled={busy} onClick={onCancel} type="button">
            Cancel
          </button>
          <button className="primary-button" disabled={busy || !value.trim()} onClick={() => void onConfirm(value.trim())} type="button">
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

export function DeleteBoardModal({
  board,
  busy,
  onCancel,
  onConfirm
}: {
  board: BoardSummary
  busy: boolean
  onCancel: () => void
  onConfirm: () => void | Promise<void>
}): ReactElement {
  return (
    <div className="modal-backdrop" onClick={onCancel} role="presentation">
      <div aria-modal="true" className="modal-card" onClick={(event) => event.stopPropagation()} role="dialog">
        <div className="modal-header">
          <div>
            <p className="eyebrow">Delete Board</p>
            <h3>{board.name}</h3>
          </div>
        </div>
        <div className="modal-body">
          <p>This will delete the board and all of its structure.</p>
          <p>Active tasks from this board will be moved to the archive as cancelled.</p>
        </div>
        <div className="modal-actions">
          <button className="icon-button" disabled={busy} onClick={onCancel} type="button">
            Cancel
          </button>
          <button className="danger-button" disabled={busy} onClick={() => void onConfirm()} type="button">
            <Trash2 size={16} />
            Delete Board
          </button>
        </div>
      </div>
    </div>
  )
}

export function NewListTemplateModal({
  busy,
  onClose,
  onSelect,
  templates
}: {
  busy: boolean
  onClose: () => void
  onSelect: (templateType: ListTemplateType) => void | Promise<void>
  templates: Array<{ value: ListTemplateType; label: string; description: string }>
}): ReactElement {
  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div aria-modal="true" className="modal-card modal-card-wide template-modal" onClick={(event) => event.stopPropagation()} role="dialog">
        <div className="modal-header">
          <div>
            <p className="eyebrow">New List</p>
            <h3>Choose a list template</h3>
          </div>
        </div>
        <div className="modal-body">
          <div className="template-choice-grid">
            {templates.map((template) => (
              <button className="template-choice-card" disabled={busy} key={template.value} onClick={() => void onSelect(template.value)} type="button">
                <strong>{template.label}</strong>
                <span>{template.description}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="modal-actions">
          <button className="icon-button" disabled={busy} onClick={onClose} type="button">
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
