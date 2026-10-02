export type SpaceSummary = {
  id: string
  name: string
  description: string
  icon: SpaceIcon
  role: 'owner' | 'admin' | 'moderator' | 'member' | 'guest'
  channel_count: number
}

export type SpaceIcon = 'layers' | 'briefcase' | 'rocket' | 'heart' | 'sparkles'

export type SpaceCategory = {
  id: string
  name: string
}

export type SpaceChannel = {
  id: string
  name: string
  type: 'discussion' | 'announcement' | 'private' | 'voice'
  category_id: string
  category_name: string
  topic: string
  can_send: boolean
  can_speak: boolean
  has_encrypted_history?: boolean
  members: SpaceChannelMember[]
  permissions?: SpaceChannelRolePermission[] | null
}

export type SpaceChannelRolePermission = {
  role: 'moderator' | 'member' | 'guest'
  can_view: boolean
  can_send: boolean
  can_speak: boolean
}

export type SpaceChannelMember = {
  id: string
  username: string
  display_name: string
}

export type SpaceMember = {
  id: string
  username: string
  display_name: string
  role: SpaceSummary['role']
}

export type SpaceMessage = {
  id: string
  chat_id: string
  server_seq: string
  sender_id: string
  display_name: string
  username: string
  body: string
  mentions: SpaceChannelMember[]
  everyone_mentioned: boolean
  is_mentioned: boolean
  created_at: string
  shared_object_id?: string | null
}

export type SpaceSharedObject = {
  id: string
  chat_id: string
  message_id: string
  object_type: 'poll' | 'event' | 'checklist' | 'decision'
  title: string
  state: 'open' | 'scheduled' | 'active' | 'completed' | 'closed' | 'cancelled' | 'ended' | 'unpinned'
  payload: {
    question?: string
    options?: { id: string; text: string }[]
    multiSelect?: boolean
    closesAt?: string | null
    anonymous?: boolean
    startsAt?: string
    endsAt?: string | null
    timezone?: string
    locationText?: string
    rsvpRequired?: boolean
    items?: { id: string; text: string; assigneeId?: string | null; dueAt?: string | null; done: boolean }[]
    quote?: string
  }
  created_by: string
  created_at: string
  updated_at: string
  terminal_at: string | null
  channel_name: string
  space_id: string
  space_name: string
  message_seq: string
  my_response: { optionIds?: string[]; rsvp?: 'yes' | 'no' | 'maybe' } | null
  response_counts: Record<string, number>
}
