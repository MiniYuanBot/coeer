import { pgTable, uuid, pgEnum, timestamp, unique, index } from 'drizzle-orm/pg-core'
import { users } from './users'
import { groups } from './groups'
import { GROUP_MEMBER_ROLES_ARRAY, GroupMemberRoles, GROUP_MEMBER_STATUSES_ARRAY, GroupMemberStatuses } from '@shared/constants'

export const groupMemberRoleEnum = pgEnum('group_member_role', GROUP_MEMBER_ROLES_ARRAY)
export const groupMemberStatusEnum = pgEnum('group_member_status', GROUP_MEMBER_STATUSES_ARRAY)

export const groupMembers = pgTable('group_members', {
    id: uuid('id').defaultRandom().primaryKey(),
    groupId: uuid('group_id')
        .references(() => groups.id, { onDelete: 'cascade' })
        .notNull(),
    userId: uuid('user_id')
        .references(() => users.id, { onDelete: 'cascade' })
        .notNull(),
    role: groupMemberRoleEnum('role').notNull().default('member'),
    status: groupMemberStatusEnum('status').notNull().default('pending'),
    joinedAt: timestamp('joined_at').defaultNow().notNull(),
}, (table) => [
    // constraint
    unique('group_members_group_id_user_id_unique').on(table.groupId, table.userId),
    // Use index to optimize query efficiency
    // index('group_members_group_id_idx').on(table.groupId),
    // index('group_members_user_id_idx').on(table.userId),
])

export type GroupMember = typeof groupMembers.$inferSelect & { role: GroupMemberRoles, status: GroupMemberStatuses }
export type NewGroupMember = typeof groupMembers.$inferInsert & { role: GroupMemberRoles, status: GroupMemberStatuses }