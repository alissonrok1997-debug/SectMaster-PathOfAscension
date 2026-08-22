import { useState, type ReactNode } from 'react'
import { UiIcon } from './UiIcon'

const COLLAPSE_THRESHOLD = 5

interface CollapsibleListProps {
  items: ReactNode[]
}

export function CollapsibleList({ items }: CollapsibleListProps) {
  const [expanded, setExpanded] = useState(false)

  if (items.length <= COLLAPSE_THRESHOLD) {
    return <ul>{items}</ul>
  }

  const hiddenCount = items.length - COLLAPSE_THRESHOLD
  const visible = expanded ? items : items.slice(items.length - COLLAPSE_THRESHOLD)

  return (
    <>
      <ul>{visible}</ul>
      <button
        className="collapse-toggle"
        aria-expanded={expanded}
        onClick={() => setExpanded((v) => !v)}
      >
        <span className={expanded ? 'collapse-arrow collapse-arrow-open' : 'collapse-arrow'} aria-hidden="true">
          <UiIcon className="ui-chevron down" name="chevron" size={20} />
        </span>
        {expanded ? 'See less' : `See ${hiddenCount} more`}
      </button>
    </>
  )
}
