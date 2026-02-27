import { relations } from 'drizzle-orm/relations'
import {
    users,
    userProfiles,
    feedbacks,
    feedbackStatusLogs,
    groups,
    groupMembers,
    groupPosts
} from './index'

export const usersRelations = relations(users, ({ one, many }) => ({
    profile: one(userProfiles, {
        fields: [users.id],
        references: [userProfiles.userId],
    }),
    feedbacks: many(feedbacks),
    createdGroups: many(groups),
    groupMemberships: many(groupMembers),
    groupPosts: many(groupPosts),
}))

export const userProfilesRelations = relations(userProfiles, ({ one }) => ({
    user: one(users, {
        fields: [userProfiles.userId],
        references: [users.id],
    }),
}))

export const feedbacksRelations = relations(feedbacks, ({ one, many }) => ({
    author: one(users, {
        fields: [feedbacks.authorId],
        references: [users.id],
    }),
    statusLogs: many(feedbackStatusLogs),
}))

export const feedbackStatusLogsRelations = relations(feedbackStatusLogs, ({ one }) => ({
    feedback: one(feedbacks, {
        fields: [feedbackStatusLogs.feedbackId],
        references: [feedbacks.id],
    }),
    changedBy: one(users, {
        fields: [feedbackStatusLogs.changedBy],
        references: [users.id],
    }),
}))

export const groupsRelations = relations(groups, ({ one, many }) => ({
    creator: one(users, {
        fields: [groups.creatorId],
        references: [users.id],
    }),
    members: many(groupMembers),
    posts: many(groupPosts),
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

export const groupPostsRelations = relations(groupPosts, ({ one, many }) => ({
    group: one(groups, {
        fields: [groupPosts.groupId],
        references: [groups.id],
    }),
    author: one(users, {
        fields: [groupPosts.authorId],
        references: [users.id],
    }),
}))
