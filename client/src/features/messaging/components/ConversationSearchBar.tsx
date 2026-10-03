import { Search, X } from 'lucide-react'

type ConversationSearchBarProps = {
  query: string
  label: string
  onQueryChange: (query: string) => void
  onClose: () => void
}

export function ConversationSearchBar({ query, label, onQueryChange, onClose }: ConversationSearchBarProps) {
  return (
    <div className="conversation-search-bar">
          <Search size={14} aria-hidden="true" />
          <input
            autoFocus
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Search loaded messages on this device"
            aria-label="Search messages in this conversation"
          />
          <span>{label}</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close message search"
          >
            <X size={14} aria-hidden="true" />
          </button>
        </div>
  )
}
