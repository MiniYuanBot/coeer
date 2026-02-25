import { relations } from 'drizzle-orm/relations'
import { users, userProfiles, feedbacks, groups, groupMembers } from './index'

export const usersRelations = relations(users, ({ one, many }) => ({
    profile: one(userProfiles, {
        fields: [users.id],
        references: [userProfiles.userId],
    }),
    feedbacks: many(feedbacks),
    createdGroups: many(groups),
    groupMemberships: many(groupMembers),
}))

export const feedbacksRelations = relations(feedbacks, ({ one }) => ({
    author: one(users, {
        fields: [feedbacks.authorId],
        references: [users.id],
    }),
}))

export const groupsRelations = relations(groups, ({ one, many }) => ({
    creator: one(users, {
        fields: [groups.creatorId],
        references: [users.id],
    }),
    members: many(groupMembers),
}))

export const groupMembersRelations = relations(groupMembers, ({ one }) => ({
    group: one(groups, {
        fields: [groupMembers.groupId],
        references: [groups.id],
    }),
    user: one(users, {
        fields: [groupMembers.userId],
        references: [users.id],
    }),
}))