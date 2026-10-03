// Test-only seeded presentation. Root API effects are suppressed by the isolated
// build transform; production modules and production configuration stay intact.
import React, { useLayoutEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import '../../client/src/index.css'
import '../../client/src/App.css'
import { AccountPanel } from '../../client/src/features/account/AccountPanel'
import { UpdatesPage } from '../../client/src/features/spaces/UpdatesPage'
import { applyAppearancePreference } from '../../client/src/shared/appearance'
const params = new URLSearchParams(location.search), scene = params.get('scene')!
const user = { id: 'me', display_name: 'Sam Rivera', username: 'sam', email: 'sam@example.test', about: 'Project member', avatar_url: null, discoverable: true, read_receipts_enabled: true }
const sessions = [{ id: 'current', device_name: 'This browser', last_active_at: '2026-10-03T08:00:00Z' }, { id: 'other', device_name: 'Other browser', last_active_at: '2026-10-02T08:00:00Z' }]
const common = { space_id: 'space', space_name: 'Project', chat_id: 'channel', channel_name: 'general', message_id: 'message', response_counts: {}, created_by: 'me', created_at: '2026-10-03T08:00:00Z' }
const poll = { ...common, id: 'poll', object_type: 'poll', title: 'Choose a plan', state: 'active', payload: { options: [{ id: 'a', text: 'Plan A' }, { id: 'b', text: 'Plan B' }] }, my_response: { optionIds: ['a'] } }
const checklist = { ...common, id: 'checklist', object_type: 'checklist', title: 'Launch checklist', state: 'active', payload: { items: [{ id: 'review', text: 'Review launch', done: false, assigneeId: 'me' }, { id: 'publish', text: 'Publish release', done: true, assigneeId: 'other' }] } }
const event = { ...common, id: 'event', object_type: 'event', title: 'Project review', state: 'active', payload: { startsAt: '2026-10-03T08:00:00Z', endsAt: '2026-10-03T09:00:00Z', timezone: 'UTC', locationText: 'Design room' }, my_response: { rsvp: 'yes' } }
const decision = { ...common, id: 'decision', object_type: 'decision', title: 'Release decision', state: 'active', payload: { quote: 'Ship the reviewed release.' } }
const stacks = scene === 'updates-items' ? { needsYou: [poll, checklist], happening: [event], decided: [decision] } : scene === 'updates-decided' ? { needsYou: [], happening: [], decided: [{ ...poll, state: 'closed' }, { ...checklist, state: 'completed' }] } : { needsYou: [], happening: [], decided: [] }
const seed: Record<string, unknown> = {
  'AccountPanel:sessions': scene === 'account-sessions' ? sessions : [], 'AccountPanel:currentSessionId': 'current', 'AccountPanel:sessionsError': scene === 'account-error' ? 'Unable to load sessions.' : '',
  'UpdatesPage:stacks': stacks, 'UpdatesPage:activeCalls': scene === 'updates-items' ? [{ id: 'call', chat_id: 'channel', call_type: 'video', status: 'active', created_at: common.created_at, title: 'Project', space_id: 'space', channel_name: 'general' }] : [],
  'UpdatesPage:error': scene === 'updates-empty-error' ? 'Unable to load Updates.' : '', 'UpdatesPage:busy': scene === 'updates-empty-error',
}
export function useVisualState(name: string, fallback: unknown) { return useState(name in seed ? seed[name] : fallback) }
function Preview() {
  useLayoutEffect(() => {
    applyAppearancePreference(params.get('theme') as 'light' | 'dark' | 'system')
    document.fonts.ready.then(() => {
      if (scene.startsWith('account')) document.querySelector('.sessions-section')?.scrollIntoView({ block: 'center' })
      requestAnimationFrame(() => requestAnimationFrame(() => { document.documentElement.dataset.visualReady = 'true' }))
    })
  }, [])
  return scene.startsWith('account') ? <AccountPanel user={user as never} appearance={params.get('theme') as 'light' | 'dark' | 'system'} onAppearanceChange={() => {}} onClose={() => {}} onSaved={() => {}} /> : <UpdatesPage userId="me" onOpenTarget={() => {}} onOpenCall={() => {}} />
}
createRoot(document.getElementById('root')!).render(<Preview />)
