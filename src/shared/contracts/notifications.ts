import { z } from 'zod'
import { PaginationSchema } from './shared'

export const ListNotificationsSchema = PaginationSchema.extend({ limit: z.number().int().min(1).max(100).default(20), unreadOnly: z.boolean().default(false) })
export const ReadNotificationSchema = z.object({ id: z.uuid().optional() })
