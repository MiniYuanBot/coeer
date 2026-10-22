import { createServerFn } from '@tanstack/react-start'
import { ListNotificationsSchema, ReadNotificationSchema } from '@shared/contracts/notifications'
import { NotificationService } from '../services/NotificationService'

export const listNotificationsFn = createServerFn({ method: 'GET' }).inputValidator(ListNotificationsSchema)
    .handler(({ data }) => NotificationService.list(data))
export const getUnreadNotificationCountFn = createServerFn({ method: 'GET' })
    .handler(() => NotificationService.unreadCount())
export const markNotificationReadFn = createServerFn({ method: 'POST' }).inputValidator(ReadNotificationSchema)
    .handler(({ data }) => NotificationService.markRead(data.id))
