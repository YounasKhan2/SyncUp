// Isolated presentation: real SpacesPage state/rendering, with root effects
// explicitly suppressed by the build-only transform. No submission is invoked.
import React, { useLayoutEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import '../../client/src/index.css'
import '../../client/src/App.css'
import { SpacesPage } from '../../client/src/features/spaces/SpacesPage'
import { applyAppearancePreference } from '../../client/src/shared/appearance'

const params = new URLSearchParams(location.search)
const scene = params.get('scene') ?? 'channel'
const categories = [{ id: 'project', name: 'Project' }, { id: 'design', name: 'Design' }]
const member = { id: 'me', username: 'sam', display_name: 'Sam Rivera', role: 'owner' }
const channel = { id: 'general', name: 'general', category_id: 'project', category_name: 'Project', type: 'discussion', topic: 'Project updates', can_send: true, can_speak: true, members: [member], permissions: [] }
const seed: Record<string, unknown> = {
  space: { id: 'space', name: 'Project', description: 'Team work', icon: 'layers', role: 'owner', categories, channels: [channel], members: [member] },
  channelId: 'general', channelDialogOpen: scene.startsWith('channel'), categoryDialogOpen: scene.startsWith('category'),
  channelName: 'design-feedback', channelTopic: 'Share drafts and review feedback', channelType: scene === 'channel-voice' ? 'voice' : 'discussion', channelCategoryId: 'design', categoryName: 'Design',
  error: scene.endsWith('busy-error') ? 'Creation could not be completed.' : '', busy: scene.endsWith('busy-error'),
}
export function useVisualState(name: string, fallback: unknown) {
  return useState(name in seed ? seed[name] : fallback)
}
function Preview() {
  useLayoutEffect(() => {
    applyAppearancePreference(params.get('theme') as 'light' | 'dark' | 'system')
    document.fonts.ready.then(() => requestAnimationFrame(() => requestAnimationFrame(() => { document.documentElement.dataset.visualReady = 'true' })))
  }, [])
  return <SpacesPage userId="me" onBack={() => {}} onJoinVoiceRoom={() => {}} />
}
createRoot(document.getElementById('root')!).render(<Preview />)
