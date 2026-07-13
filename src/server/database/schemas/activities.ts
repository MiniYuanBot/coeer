import { integer, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core'
import { users } from './users'
import {
    ACTIVITY_STATUS_ARRAY,
    ACTIVITY_TYPE_ARRAY,
    ActivityStatus,
    ActivityType,
    ORGANIZER_TYPE_ARRAY,
    OrganizerType,
    PARTICIPANT_STATUS_ARRAY,
    ParticipantStatus,
} from '@shared/constants'

export const activityTypeEnum = pgEnum('activity_type', ACTIVITY_TYPE_ARRAY)
export const organizerTypeEnum = pgEnum('organizer_type', ORGANIZER_TYPE_ARRAY)
export const activityStatusEnum = pgEnum('activity_status', ACTIVITY_STATUS_ARRAY)
export const participantStatusEnum = pgEnum('participant_status', PARTICIPANT_STATUS_ARRAY)

export const activities = pgTable('activities', {
    id: uuid('id').defaultRandom().primaryKey(),
    title: varchar('title', { length: 200 }).notNull(),
    description: text('description').notNull(),
    type: activityTypeEnum('type').notNull(),
    organizerId: uuid('organizer_id').notNull(),
    organizerType: organizerTypeEnum('organizer_type').notNull(),
    location: varchar('location', { length: 200 }),
    startTime: timestamp('start_time', { withTimezone: true }).notNull(),
    endTime: timestamp('end_time', { withTimezone: true }).notNull(),
    maxParticipants: integer('max_participants'),
    status: activityStatusEnum('status').default('upcoming').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export const activityParticipants = pgTable('activity_participants', {
    id: uuid('id').defaultRandom().primaryKey(),
    activityId: uuid('activity_id').references(() => activities.id, { onDelete: 'cascade' }).notNull(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
    status: participantStatusEnum('status').default('registered').notNull(),
    registeredAt: timestamp('registered_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
    uniqueIndex('activity_participants_activity_user_unique').on(table.activityId, table.userId),
])

export type Activity = typeof activities.$inferSelect & {
    type: ActivityType
    organizerType: OrganizerType
    status: ActivityStatus
}
export type NewActivity = typeof activities.$inferInsert & {
    type: ActivityType
    organizerType: OrganizerType
    status?: ActivityStatus
}
export type ActivityParticipant = typeof activityParticipants.$inferSelect & { status: ParticipantStatus }
export type NewActivityParticipant = typeof activityParticipants.$inferInsert & { status?: ParticipantStatus }

