import { useState } from 'react'

type UpdatesTarget = { spaceId: string; channelId: string; messageId: string }

// Workspace-local view state. Domain work stays with the caller; intentionally
// asymmetric transitions retain the existing navigation contracts.
export function useWorkspaceNavigation() {
  const [showRequests, setShowRequests] = useState(false)
  const [showCalls, setShowCalls] = useState(false)
  const [showUpdates, setShowUpdates] = useState(false)
  const [showSpaces, setShowSpaces] = useState(false)
  const [updatesTarget, setUpdatesTarget] = useState<UpdatesTarget | null>(null)
  const [activeChatId, setActiveChatId] = useState<string | null>(null)

  function showChatsHome() {
    setShowCalls(false)
    setShowUpdates(false)
    setShowSpaces(false)
    setShowRequests(false)
    if (window.matchMedia('(max-width: 700px)').matches) setActiveChatId(null)
  }

  function selectChat(chatId: string) {
    setShowCalls(false)
    setShowUpdates(false)
    setShowSpaces(false)
    setShowRequests(false)
    setActiveChatId(chatId)
  }

  function openCalls() {
    setShowCalls(true)
    setShowUpdates(false)
    setShowSpaces(false)
    setShowRequests(false)
    if (window.matchMedia('(max-width: 700px)').matches) setActiveChatId(null)
  }

  function openUpdates() {
    setShowUpdates(true)
    setShowCalls(false)
    setShowSpaces(false)
    setShowRequests(false)
    setActiveChatId(null)
    setUpdatesTarget(null)
  }

  function openSpaces() {
    setShowCalls(false)
    setShowUpdates(false)
    setShowRequests(false)
    setShowSpaces(true)
    setActiveChatId(null)
    setUpdatesTarget(null)
  }

  function openUpdateTarget(spaceId: string, channelId: string, messageId: string) {
    setShowUpdates(false)
    setShowCalls(false)
    setShowSpaces(true)
    setShowRequests(false)
    setActiveChatId(null)
    setUpdatesTarget({ spaceId, channelId, messageId })
  }

  function openConvertedSpace(spaceId: string, channelId: string) {
    setShowCalls(false)
    setShowUpdates(false)
    setShowRequests(false)
    setShowSpaces(true)
    setActiveChatId(null)
    setUpdatesTarget({ spaceId, channelId, messageId: '' })
  }

  function selectSearchChat(chatId: string) {
    setShowCalls(false)
    setShowRequests(false)
    setActiveChatId(chatId)
  }

  return {
    showRequests, setShowRequests, showCalls, setShowCalls, showUpdates, showSpaces,
    updatesTarget, activeChatId, setActiveChatId,
    showChatsHome, selectChat, openCalls, openUpdates, openSpaces,
    openUpdateTarget, openConvertedSpace, selectSearchChat,
  }
}
