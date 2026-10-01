import { RoomServiceClient } from 'livekit-server-sdk'
import type { PoolClient } from 'pg'

function roomService() {
  const url = process.env.LIVEKIT_URL
  const apiKey = process.env.LIVEKIT_API_KEY
  const apiSecret = process.env.LIVEKIT_API_SECRET
  if (!url || !apiKey || !apiSecret) {
    throw new Error('LiveKit is not configured for group-call teardown.')
  }
  return new RoomServiceClient(url, apiKey, apiSecret)
}

export async function closeLiveKitRoom(roomName: string) {
  const service = roomService()
  const rooms = await service.listRooms([roomName])
  if (rooms.some((room) => room.name === roomName)) {
    await service.deleteRoom(roomName)
  }
}

export async function endGroupCallsForMembershipChange(client: PoolClient, chatId: string) {
  const active = await client.query<{ id: string; sfu_room: string }>(
    `SELECT id, sfu_room FROM group_calls
     WHERE chat_id = $1 AND status = 'active'
     FOR UPDATE`,
    [chatId],
  )
  if (active.rows.length === 0) return

  for (const call of active.rows) {
    await closeLiveKitRoom(call.sfu_room)
  }
  await client.query(
    `UPDATE group_calls
     SET status = 'ended', end_reason = 'membership_changed', ended_at = now()
     WHERE chat_id = $1 AND status = 'active'`,
    [chatId],
  )
}

export async function removeGroupCallParticipant(roomName: string, userId: string) {
  const service = roomService()
  const rooms = await service.listRooms([roomName])
  if (!rooms.some((room) => room.name === roomName)) return
  const participants = await service.listParticipants(roomName)
  if (!participants.some((participant) => participant.identity === userId)) return
  await service.removeParticipant(roomName, userId, {
    revokeTokenTs: BigInt(Math.floor(Date.now() / 1000)),
  })
}
