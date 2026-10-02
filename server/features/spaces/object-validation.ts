import { z } from 'zod'

const pollSchema = z.object({
  type: z.literal('poll'),
  question: z.string().trim().min(1).max(240),
  options: z.array(z.string().trim().min(1).max(100)).min(2).max(8),
  multiSelect: z.boolean().default(false),
  closesAt: z.iso.datetime().nullable().default(null),
  anonymous: z.boolean().default(false),
})
const eventSchema = z.object({
  type: z.literal('event'),
  title: z.string().trim().min(1).max(160),
  startsAt: z.iso.datetime(),
  endsAt: z.iso.datetime().nullable().default(null),
  timezone: z.string().trim().min(1).max(80),
  locationText: z.string().trim().max(240).default(''),
  rsvpRequired: z.boolean().default(true),
})
const checklistSchema = z.object({
  type: z.literal('checklist'),
  title: z.string().trim().min(1).max(160),
  items: z.array(z.object({
    text: z.string().trim().min(1).max(240),
    assigneeId: z.uuid().nullable().default(null),
    dueAt: z.iso.datetime().nullable().default(null),
  })).min(1).max(30),
})
export const createSchema = z.discriminatedUnion('type', [pollSchema, eventSchema, checklistSchema])
