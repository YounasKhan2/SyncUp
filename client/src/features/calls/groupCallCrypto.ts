import type { PublicMember } from '../../shared/types'
import { wrapMediaKeyForMembers } from '../auth/crypto/crypto'

export async function createGroupCallKey(members: PublicMember[]) {
  const { isE2EESupported } = await import('livekit-client')
  if (!isE2EESupported()) {
    throw new Error('This browser cannot securely encrypt group-call media.')
  }

  const rawKey = crypto.getRandomValues(new Uint8Array(32))
  try {
    const keyEnvelopes = await wrapMediaKeyForMembers(rawKey, members)
    return { rawKey, keyEnvelopes }
  } catch (error) {
    rawKey.fill(0)
    throw error
  }
}
