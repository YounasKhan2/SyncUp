import { useEffect, useState } from 'react'
import { MessageSquare, Search, UserRound, X } from 'lucide-react'
import { api } from '../../shared/api'

type SearchResults = {
  people: { id: string; username: string; display_name: string }[]
  chats: { id: string; kind: 'direct' | 'group'; display_title: string; peer_username: string | null }[]
  privacy: string
}

export function SearchDialog({ onClose, onSelectChat, onSelectPerson }: {
  onClose: () => void
  onSelectChat: (chatId: string) => void
  onSelectPerson: (username: string) => void
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResults>({ people: [], chats: [], privacy: '' })
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const value = query.trim()
    if (value.length < 2) return
    const controller = new AbortController()
    const timeout = window.setTimeout(() => {
      void api<SearchResults>(`/api/search?q=${encodeURIComponent(value)}`, { signal: controller.signal })
        .then((response) => { setResults(response); setError('') })
        .catch((searchError: unknown) => {
          if (!controller.signal.aborted) setError(searchError instanceof Error ? searchError.message : 'Unable to search SyncUp.')
        })
        .finally(() => {
          if (!controller.signal.aborted) setSearching(false)
        })
    }, 250)
    return () => {
      window.clearTimeout(timeout)
      controller.abort()
    }
  }, [query])

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [onClose])

  return (
    <div className="overlay search-overlay" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose()
    }}>
      <section className="account-dialog search-dialog" role="dialog" aria-modal="true" aria-labelledby="global-search-title">
        <div className="dialog-heading">
          <div><p className="eyebrow">FIND A CONVERSATION</p><h2 id="global-search-title">Search SyncUp</h2></div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close search"><X size={15} aria-hidden="true" /></button>
        </div>
        <label className="global-search-input">
          <Search size={15} aria-hidden="true" />
          <input autoFocus value={query} onChange={(event) => {
            const value = event.target.value
            setQuery(value)
            if (value.trim().length < 2) {
              setSearching(false)
              setError('')
            } else {
              setSearching(true)
              setError('')
            }
          }} placeholder="People or chat names" aria-label="Search people and chats" />
          <kbd>ESC</kbd>
        </label>
        <div className="global-search-results" aria-live="polite">
          {query.trim().length > 0 && query.trim().length < 2 && <p className="search-empty">Enter at least 2 characters.</p>}
          {searching && <p className="search-empty" role="status">Searching people and chats…</p>}
          {error && <p className="search-error" role="alert">{error}</p>}
          {!searching && !error && query.trim().length >= 2 && results.people.length > 0 && <>
            <p className="search-section-label">PEOPLE</p>
            {results.people.map((person) => (
              <button className="search-result" type="button" key={person.id} onClick={() => onSelectPerson(person.username)}>
                <UserRound size={15} aria-hidden="true" />
                <span><strong>{person.display_name}</strong><small>@{person.username}</small></span>
              </button>
            ))}
          </>}
          {!searching && !error && query.trim().length >= 2 && results.chats.length > 0 && <>
            <p className="search-section-label">CHATS</p>
            {results.chats.map((chat) => (
              <button className="search-result" type="button" key={chat.id} onClick={() => onSelectChat(chat.id)}>
                <MessageSquare size={15} aria-hidden="true" />
                <span><strong>{chat.display_title}</strong><small>{chat.kind === 'group' ? 'Group' : `@${chat.peer_username}`}</small></span>
              </button>
            ))}
          </>}
          {!searching && !error && query.trim().length >= 2 && results.people.length === 0 && results.chats.length === 0 && <p className="search-empty">No people or chats found.</p>}
        </div>
        <p className="search-privacy-note">Encrypted messages are never searched on the server. Use search inside a conversation to find messages already loaded on this device.</p>
      </section>
    </div>
  )
}
