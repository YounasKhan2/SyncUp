export type KeyBundle = {
  publicKey: JsonWebKey
  encryptedPrivateKey: string
  privateKeyIv: string
  vaultSalt: string
}

export type PublicMember = {
  id: string
  publicKey: JsonWebKey
}

export type User = {
  id: string
  email: string
  username: string
  display_name: string
  avatar_url?: string | null
  about?: string
  discoverable?: boolean
  read_receipts_enabled?: boolean
}

export type Session = {
  id: string
  device_name: string
  platform: string
  user_agent: string
  created_at: string
  last_active_at: string
  expires_at: string
}

export type AuthMode = 'sign-in' | 'sign-up'
export type ChatKind = 'direct' | 'group'

export type Chat = {
  id: string
  kind: ChatKind
  title: string | null
  display_title: string
  peer_username: string | null
  peer_avatar_url?: string | null
  last_seq: string
  last_read_seq: string
  unread_count: number
  last_message_id: string | null
  last_sender_id: string | null
  last_body_ciphertext: string | null
  last_body_nonce: string | null
  last_key_envelope: string | null
  last_message_created_at: string | null
  preview?: string
}

export type ChatMember = PublicMember & {
  username: string
  displayName: string
  role: string
  avatar_url?: string | null
}

export type EncryptedChatMessage = {
  id: string
  chat_id: string
  server_seq: string
  sender_id: string
  body_ciphertext: string
  body_nonce: string
  key_envelope: string | null
  reply_to_id: string | null
  edited_at?: string | null
  deleted_at?: string | null
  hidden_by_me?: boolean
  pinned_at?: string | null
  pinned_by?: string | null
  reply_context?: EncryptedMessageReplyContext | null
  delivery_receipts?: string[]
  read_by?: string[]
  created_at: string
  reactions: { user_id: string; emoji: string }[]
  attachments: {
    id: string
    filename: string
    content_type: string
    size_bytes: number
    nonce: string | null
    key_envelope: string
    transport_version?: number
    duration_ms?: number | null
    waveform?: number[] | null
    width?: number | null
    height?: number | null
    is_preview?: boolean
    preview?: StagedAttachment | null
    poster_attachment_id?: string | null
  }[]
}

export type EncryptedMessageReplyContext = {
  id: string
  server_seq: string
  sender_id: string
  body_ciphertext: string
  body_nonce: string
  key_envelope: string | null
  deleted_at: string | null
  attachment_types: string[]
}

export type DisplayMessage = EncryptedChatMessage & {
  text: string
  pending?: boolean
  failed?: boolean
  reply_context?: (EncryptedMessageReplyContext & { text: string }) | null
}

export type CallRecord = {
  id: string
  chat_id: string
  call_type: 'audio' | 'video'
  status: string
  end_reason: string | null
  caller_id: string
  callee_id: string
  created_at: string
  accepted_at: string | null
  ended_at: string | null
  other_name?: string
  caller_name?: string
  callee_name?: string
  caller_username?: string
  other_avatar_url?: string | null
  is_group?: boolean
  group_title?: string
  participant_count?: number
}

export type IncomingCall = {
  id: string
  chat_id: string
  call_type: 'audio' | 'video'
  caller_name: string
  caller_username: string
  caller_avatar_url?: string | null
  is_group?: boolean
  group_title?: string
}

export type ActiveCall = {
  id: string
  chatId: string
  callType: 'audio' | 'video'
  title: string
  isGroup?: boolean
  isHost?: boolean
  e2eeKey?: Uint8Array
  isVoiceRoom?: boolean
  voiceSpaceId?: string
  voiceChannelId?: string
  canPublish?: boolean
}

export type StagedAttachment = {
  id: string
  filename: string
  content_type: string
  size_bytes: number
  nonce: string | null
  key_envelope: string
  transport_version?: number
  duration_ms?: number | null
  waveform?: number[] | null
  width?: number | null
  height?: number | null
  is_preview?: boolean
  preview?: StagedAttachment | null
  poster_attachment_id?: string | null
}

export type IncomingRequest = {
  id: string
  chat_id: string
  from_user: string
  username: string
  display_name: string
  avatar_url: string | null
  message_id: string
  server_seq: string
  body_ciphertext: string
  body_nonce: string
  key_envelope: string | null
  message_created_at: string
}

export type DiscoveredUser = PublicMember & {
  username: string
  display_name: string
  avatar_url: string | null
}

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
