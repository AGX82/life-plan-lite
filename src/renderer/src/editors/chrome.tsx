import { ChevronDown, ChevronRight } from 'lucide-react'
import type { ReactElement } from 'react'

export function EditorHeading({ eyebrow, title }: { eyebrow: string; title: string }): ReactElement {
  return (
    <header className="panel-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h3>{title}</h3>
      </div>
    </header>
  )
}

export function CollapsibleEditorSectionHeader({
  expanded,
  onToggle,
  title
}: {
  expanded: boolean
  onToggle: () => void
  title: string
}): ReactElement {
  return (
    <button className="editor-section-toggle" onClick={onToggle} type="button">
      <span className="editor-section-toggle-main">
        <span className="editor-section-toggle-icon">{expanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}</span>
        <h3>{title}</h3>
      </span>
    </button>
  )
}
