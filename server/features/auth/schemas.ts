import { z } from 'zod'

export const keyBundleSchema = z.object({
  publicKey: z.object({
    kty: z.literal('RSA'),
    n: z.string().min(100).max(2000),
    e: z.string().min(1).max(20),
    alg: z.literal('RSA-OAEP-256'),
    ext: z.literal(true),
    key_ops: z.array(z.literal('encrypt')).length(1),
  }),
  encryptedPrivateKey: z.string().min(100).max(16_384),
  privateKeyIv: z.string().min(12).max(64),
  vaultSalt: z.string().min(16).max(64),
})

export const signUpSchema = z.object({
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  username: z.string().trim().min(3).max(24).regex(/^[a-zA-Z0-9_]+$/)
    .transform((value) => value.toLowerCase()),
  displayName: z.string().trim().min(1).max(60),
  password: z.string().min(10).max(128),
  keyBundle: keyBundleSchema,
})

export const signInSchema = z.object({
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  password: z.string().min(1).max(128),
})

export const initializeKeysSchema = z.object({
  password: z.string().min(1).max(128),
  keyBundle: keyBundleSchema,
})

export const profileSchema = z.object({
  username: z.string().trim().min(3).max(24).regex(/^[a-zA-Z0-9_]+$/)
    .transform((value) => value.toLowerCase()),
  displayName: z.string().trim().min(1).max(60),
  about: z.string().trim().max(160).default(''),
  discoverable: z.boolean().optional(),
  readReceiptsEnabled: z.boolean().optional(),
})
