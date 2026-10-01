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
  pinned_by_me?: boolean
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

export type DisplayMessage = EncryptedChatMessage & { text: string; pending?: boolean; failed?: boolean }

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
