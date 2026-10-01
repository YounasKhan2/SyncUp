import { useEffect, useState } from 'react'
import { ArrowUpRight, X } from 'lucide-react'
import { decryptMessage } from '../auth/crypto/crypto'
import type { IncomingRequest } from '../../shared/types'
import { Avatar } from '../../shared/components/Avatar'
export function RequestsPanel({ requests, onAccept, onIgnore, onClose }: {
  requests: IncomingRequest[]
  onAccept: (request: IncomingRequest) => void
  onIgnore: (request: IncomingRequest) => void
  onClose: () => void
}) {
  const [previews, setPreviews] = useState<Record<string, string>>({})

  useEffect(() => {
    let active = true
    Promise.all(requests.map(async (item) => {
      try {
        const text = await decryptMessage({
          bodyCiphertext: item.body_ciphertext,
          bodyNonce: item.body_nonce,
          keyEnvelope: item.key_envelope,
        })
        return [item.id, text] as const
      } catch {
        return [item.id, 'Encrypted message'] as const
      }
    })).then((entries) => {
      if (active) setPreviews(Object.fromEntries(entries))
    })
    return () => { active = false }
  }, [requests])

  return (
    <section className="request-list-panel">
      <div className="request-list-header"><div><h2>Message requests</h2><p>Only requests you accept become regular chats.</p></div><button className="icon-button" type="button" onClick={onClose} aria-label="Close requests"><X size={15} aria-hidden="true" /></button></div>
      {requests.length === 0 ? (
        <div className="empty-request"><div className="empty-symbol"><ArrowUpRight size={18} aria-hidden="true" /></div><p className="empty-title">No message requests</p><p className="empty-copy">New messages from people you haven’t connected with will appear here.</p></div>
      ) : requests.map((item) => (
        <article className="request-card" key={item.id}>
          <Avatar name={item.display_name} src={item.avatar_url} />
          <div className="request-card-content"><strong>{item.display_name}</strong><small>@{item.username}</small><p>{previews[item.id] ?? 'Decrypting private message…'}</p></div>
          <div className="request-actions"><button type="button" className="accept-request" onClick={() => onAccept(item)}>Accept</button><button type="button" onClick={() => onIgnore(item)}>Ignore</button></div>
        </article>
      ))}
    </section>
  )
}
