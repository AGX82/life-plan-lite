import type { ReactElement } from 'react'

export function ConfirmActionModal({
  busy,
  confirmLabel = 'Confirm',
  destructive = false,
  message,
  onCancel,
  onConfirm,
  title
}: {
  busy: boolean
  confirmLabel?: string
  destructive?: boolean
  message: string
  onCancel: () => void
  onConfirm: () => void | Promise<void>
  title: string
}): ReactElement {
  return (
    <div className="modal-backdrop" onClick={onCancel} role="presentation">
      <div aria-modal="true" className="modal-card message-modal" onClick={(event) => event.stopPropagation()} role="dialog">
        <div className="modal-header">
          <div>
            <p className="eyebrow">Confirm</p>
            <h3>{title}</h3>
          </div>
        </div>
        <div className="modal-body">
          <p>{message}</p>
        </div>
        <div className="modal-actions">
          <button className="icon-button" disabled={busy} onClick={onCancel} type="button">
            Cancel
          </button>
          <button className={destructive ? 'danger-button' : 'primary-button'} disabled={busy} onClick={() => void onConfirm()} type="button">
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

export function MessageModal({
  title,
  message,
  onClose
}: {
  title: string
  message: string
  onClose: () => void
}): ReactElement {
  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div aria-modal="true" className="modal-card message-modal" onClick={(event) => event.stopPropagation()} role="dialog">
        <div className="modal-header">
          <div>
            <p className="eyebrow">Notice</p>
            <h3>{title}</h3>
          </div>
        </div>
        <div className="modal-body">
          <p>{message}</p>
        </div>
        <div className="modal-actions">
          <button autoFocus className="primary-button" onClick={onClose} type="button">
            OK
          </button>
        </div>
      </div>
    </div>
  )
}
