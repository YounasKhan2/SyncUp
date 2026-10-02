import { z } from 'zod'

export const fileMaxBytes = 25 * 1024 * 1024
export const imageMaxBytes = 10 * 1024 * 1024
export const allowedTypes = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/zip',
  'text/plain',
  'text/csv',
  'image/gif',
  'image/jpeg',
  'image/png',
  'image/webp',
  'video/mp4',
  'video/webm',
])

export const fileNameSchema = z.string().trim().min(1).max(200).refine(
  (name) => !/[\\/\u0000-\u001f\u007f]/u.test(name) && name !== '.' && name !== '..',
)
