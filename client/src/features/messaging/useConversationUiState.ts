import { useState } from 'react'

// Auxiliary Conversation views only. Reply/edit/draft and runtime workflows
// remain with Conversation because their transitions have domain side effects.
export function useConversationUiState() {
  const [reportingMessageId, setReportingMessageId] = useState<string | null>(null)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [messageSearchOpen, setMessageSearchOpen] = useState(false)
  const [messageSearch, setMessageSearch] = useState('')

  function openReport(messageId: string) { setReportingMessageId(messageId) }
  function closeReport() { setReportingMessageId(null) }
  function openDetails() { setDetailsOpen(true) }
  function closeDetails() { setDetailsOpen(false) }
  function toggleMessageSearch() { setMessageSearchOpen((open) => !open) }
  function closeMessageSearch() {
    setMessageSearchOpen(false)
    setMessageSearch('')
  }

  return {
    reportingMessageId, detailsOpen, messageSearchOpen, messageSearch,
    setMessageSearch, openReport, closeReport, openDetails, closeDetails,
    toggleMessageSearch, closeMessageSearch,
  }
}
