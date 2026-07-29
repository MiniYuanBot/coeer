import { boolean, integer, jsonb, pgEnum, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'
import { users } from './users'
import { DORM_CYCLE_STATUS_ARRAY, DORM_CYCLE_STATUS, DORM_ROOM_STATUS_ARRAY, DORM_ROOM_STATUS } from '@shared/constants'

export const dormCycleStatusEnum = pgEnum('dorm_cycle_status', DORM_CYCLE_STATUS_ARRAY)
export const dormRoomStatusEnum = pgEnum('dorm_room_status', DORM_ROOM_STATUS_ARRAY)
export const dormGenderEnum = pgEnum('dorm_gender', ['male', 'female', 'other'])

export const dormCycles = pgTable('dorm_cycles', {
    id: uuid('id').defaultRandom().primaryKey(),
    code: varchar('code', { length: 100 }).notNull().unique(),
    label: varchar('label', { length: 100 }).notNull(),
    cohortLabel: varchar('cohort_label', { length: 100 }).notNull(),
    questionnaireVersion: varchar('questionnaire_version', { length: 100 }),
    status: dormCycleStatusEnum('status').notNull().default('collecting'),
    confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export const dormStudentProfiles = pgTable('dorm_student_profiles', {
    id: uuid('id').defaultRandom().primaryKey(),
    cycleId: uuid('cycle_id').references(() => dormCycles.id, { onDelete: 'cascade' }).notNull(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
    studentNo: varchar('student_no', { length: 50 }),
    gender: dormGenderEnum('gender').notNull(),
    college: varchar('college', { length: 100 }),
    major: varchar('major', { length: 100 }),
    cohortLabel: varchar('cohort_label', { length: 100 }).notNull(),
    height: integer('height'),
    specialNeeds: jsonb('special_needs').notNull().default({}),
    isSmoking: boolean('is_smoking').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export const dormQuestionnaires = pgTable('dorm_questionnaires', {
    id: uuid('id').defaultRandom().primaryKey(),
    cycleId: uuid('cycle_id').references(() => dormCycles.id, { onDelete: 'cascade' }).notNull(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
    cohortLabel: varchar('cohort_label', { length: 100 }).notNull(),
    studentNo: varchar('student_no', { length: 50 }),
    gender: dormGenderEnum('gender').notNull(),
    college: varchar('college', { length: 100 }),
    major: varchar('major', { length: 100 }),
    height: integer('height'),
    specialNeeds: jsonb('special_needs').notNull().default({}),
    answers: jsonb('answers').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export const dormRooms = pgTable('dorm_rooms', {
    id: uuid('id').defaultRandom().primaryKey(),
    cycleId: uuid('cycle_id').references(() => dormCycles.id, { onDelete: 'cascade' }).notNull(),
    roomCode: varchar('room_code', { length: 100 }).notNull(),
    building: varchar('building', { length: 100 }),
    floor: integer('floor'),
    poolTag: varchar('pool_tag', { length: 100 }).notNull(),
    members: text('members').array().notNull().default([]),
    capacity: integer('capacity').notNull().default(4),
    avgScore: integer('avg_score').notNull().default(0),
    status: dormRoomStatusEnum('status').notNull().default('draft'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [])

export type DormCycle = typeof dormCycles.$inferSelect & { status: typeof DORM_CYCLE_STATUS[keyof typeof DORM_CYCLE_STATUS] }
export type NewDormCycle = typeof dormCycles.$inferInsert
export type DormStudentGender = 'male' | 'female' | 'other'
export type DormStudentProfile = typeof dormStudentProfiles.$inferSelect & { gender: DormStudentGender }
export type NewDormStudentProfile = typeof dormStudentProfiles.$inferInsert & { gender: DormStudentGender }
export type DormQuestionnaire = typeof dormQuestionnaires.$inferSelect
export type NewDormQuestionnaire = typeof dormQuestionnaires.$inferInsert
export type DormRoom = typeof dormRooms.$inferSelect & { status: typeof DORM_ROOM_STATUS[keyof typeof DORM_ROOM_STATUS] }
export type NewDormRoom = typeof dormRooms.$inferInsert
