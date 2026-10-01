export type TextLinkPart = {
  text: string
  href?: string
}

const urlPattern = /https?:\/\/[^\s<>"']+|www\.[^\s<>"']+/giu
const trailingPunctuation = /[.,!?;:)}\]]+$/u

export function countUnreadConversations(chats: readonly { unread_count: number | string }[]) {
  return chats.reduce((count, chat) => count + (Number(chat.unread_count) > 0 ? 1 : 0), 0)
}

export function sortChronologically<T extends { created_at: string }>(items: readonly T[]) {
  return [...items].sort((left, right) => Date.parse(left.created_at) - Date.parse(right.created_at))
}

export function splitMessageLinks(text: string): TextLinkPart[] {
  const parts: TextLinkPart[] = []
  let lastIndex = 0

  for (const match of text.matchAll(urlPattern)) {
    const matchedText = match[0]
    const start = match.index
    if (start === undefined) continue
    const punctuation = matchedText.match(trailingPunctuation)?.[0] ?? ''
    const candidate = punctuation ? matchedText.slice(0, -punctuation.length) : matchedText
    const normalized = candidate.toLocaleLowerCase().startsWith('www.')
      ? `https://${candidate}`
      : candidate
    let href: string | undefined
    try {
      const url = new URL(normalized)
      if ((url.protocol === 'https:' || url.protocol === 'http:') && !url.username && !url.password) {
        href = url.href
      }
    } catch {
      href = undefined
    }
    if (!href) continue
    if (start > lastIndex) parts.push({ text: text.slice(lastIndex, start) })
    parts.push({ text: candidate, href })
    if (punctuation) parts.push({ text: punctuation })
    lastIndex = start + matchedText.length
  }

  if (lastIndex < text.length) parts.push({ text: text.slice(lastIndex) })
  return parts.length > 0 ? parts : [{ text }]
}

export function insertAtSelection(value: string, selectionStart: number, selectionEnd: number, insertion: string) {
  const start = Math.max(0, Math.min(selectionStart, value.length))
  const end = Math.max(start, Math.min(selectionEnd, value.length))
  return {
    value: `${value.slice(0, start)}${insertion}${value.slice(end)}`,
    cursor: start + insertion.length,
  }
}
