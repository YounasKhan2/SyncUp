import { z } from 'zod'

const encodedBytes = z.string().regex(/^[A-Za-z0-9_-]+$/).min(16).max(16_384)
const envelopesSchema = z.record(z.uuid(), encodedBytes).refine(
  (value) => Object.keys(value).length >= 2 && Object.keys(value).length <= 32,
)
export const encryptedMessageSchema = z.object({
  bodyCiphertext: encodedBytes.max(20_000),
  bodyNonce: z.string().regex(/^[A-Za-z0-9_-]{16}$/),
  keyEnvelopes: envelopesSchema,
  attachmentIds: z.array(z.uuid()).max(10).default([]),
  idempotencyKey: z.uuid(),
  replyToId: z.uuid().optional(),
})

export type MemberKey = { user_id: string; encryption_public_key: JsonWebKey | null }

export function matchingEnvelopes(envelopes: Record<string, string>, members: MemberKey[]) {
  const expected = members.map((member) => member.user_id).sort()
  const supplied = Object.keys(envelopes).sort()
  return expected.length >= 2
    && expected.length <= 32
    && members.every((member) => member.encryption_public_key !== null)
    && expected.length === supplied.length
    && expected.every((userId, index) => userId === supplied[index])
}

