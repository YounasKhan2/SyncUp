import { useEffect, useState } from 'react'
import { Search, X } from 'lucide-react'
import { Avatar } from '../../shared/components/Avatar'
import { api } from '../../shared/api'
import type { Chat } from '../../shared/types'

type SearchResults = {
  people: { id: string; username: string; display_name: string; avatar_url: string | null }[]
  chats: { id: string; kind: 'direct' | 'group'; display_title: string; peer_username: string | null; peer_avatar_url?: string | null }[]
  privacy: string
}

export type SearchableMessage = {
  id: string
  chatId: string
  senderName: string
  text: string
  createdAt: string
}

export function SearchDialog({ chats, messages, onClose, onSelectChat, onSelectPerson }: {
  chats: Chat[]
  messages: SearchableMessage[]
  onClose: () => void
  onSelectChat: (chatId: string) => void
  onSelectPerson: (username: string) => void
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResults>({ people: [], chats: [], privacy: '' })
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState('')
  const value = query.trim()
  const normalizedQuery = value.toLocaleLowerCase()
  const accessibleChatIds = new Set(chats.map((chat) => chat.id))
  const matchedMessages = value.length >= 2
    ? messages.filter((message) => accessibleChatIds.has(message.chatId)
      && message.text.toLocaleLowerCase().includes(normalizedQuery)).slice(0, 20)
    : []
  const chatsById = new Map(chats.map((chat) => [chat.id, chat]))

  useEffect(() => {
    if (value.length < 2) {
      setSearching(false)
      setResults({ people: [], chats: [], privacy: '' })
      setError('')
      return
    }
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
  }, [value])

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
          }} placeholder="People, chats, or messages" aria-label="Search people, chats, and loaded messages" />
          <kbd>ESC</kbd>
        </label>
        <div className="global-search-results" aria-live="polite">
          {value.length > 0 && value.length < 2 && <p className="search-empty">Enter at least 2 characters.</p>}
          {value.length >= 2 && <>
            <p className="search-section-label">MESSAGES LOADED THIS SESSION</p>
            {matchedMessages.map((message) => {
              const chat = chatsById.get(message.chatId)
              const title = chat?.display_title ?? chat?.title ?? 'Conversation'
              return (
                <button className="search-result search-message-result" type="button" key={`${message.chatId}:${message.id}`} onClick={() => onSelectChat(message.chatId)} aria-label={`Open message in ${title}`}>
                  <span className="search-message-icon" aria-hidden="true">↳</span>
                  <span><strong>{title}</strong><small>{message.senderName} · {new Date(message.createdAt).toLocaleString()}</small><span className="search-message-snippet">{message.text}</span></span>
                </button>
              )
            })}
            {matchedMessages.length === 0 && <p className="search-empty">No matching decrypted messages have been loaded in this session.</p>}
          </>}
          {searching && <p className="search-empty" role="status">Searching people and chats…</p>}
          {error && <p className="search-error" role="alert">{error}</p>}
          {!searching && !error && query.trim().length >= 2 && results.people.length > 0 && <>
            <p className="search-section-label">PEOPLE</p>
            {results.people.map((person) => (
              <button className="search-result" type="button" key={person.id} onClick={() => onSelectPerson(person.username)}>
                <Avatar name={person.display_name} src={person.avatar_url} />
                <span><strong>{person.display_name}</strong><small>@{person.username}</small></span>
              </button>
            ))}
          </>}
          {!searching && !error && query.trim().length >= 2 && results.chats.length > 0 && <>
            <p className="search-section-label">CHATS</p>
            {results.chats.map((chat) => (
              <button className="search-result" type="button" key={chat.id} onClick={() => onSelectChat(chat.id)}>
                <Avatar name={chat.display_title} src={chat.peer_avatar_url} />
                <span><strong>{chat.display_title}</strong><small>{chat.kind === 'group' ? 'Group' : `@${chat.peer_username}`}</small></span>
              </button>
            ))}
          </>}
          {!searching && !error && value.length >= 2 && results.people.length === 0 && results.chats.length === 0 && <p className="search-empty">No people or chats found.</p>}
        </div>
        <p className="search-privacy-note">Encrypted message text is searched locally and never sent to the server. Global results include decrypted messages loaded during this app session; search inside a chat to filter its currently loaded history.</p>
      </section>
    </div>
  )
}
