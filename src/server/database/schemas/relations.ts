import { relations } from 'drizzle-orm/relations'
import { achievements, userAchievements } from './achievements'
import { activities, activityParticipants } from './activities'
import { cards, userCards } from './cards'
import { dormCycles, dormQuestionnaires, dormRooms } from './dorms'
import { feedbacks, feedbackStatusLogs } from './feedbacks'
import { groupMembers } from './groupMembers'
import { groupPosts } from './groupPosts'
import { groups } from './groups'
import { pointTransactions } from './points'
import { reactions } from './reactions'
import { redeemItems, redeemOrders } from './redeems'
import { replies } from './replies'
import { userSubscriptions } from './subscriptions'
import { users, userProfiles } from './users'

export const usersRelations = relations(users, ({ one, many }) => ({
    profile: one(userProfiles, {
        fields: [users.id],
        references: [userProfiles.userId],
    }),
    feedbacks: many(feedbacks),
    createdGroups: many(groups),
    groupMemberships: many(groupMembers),
    groupPosts: many(groupPosts),
    reactions: many(reactions),
    replies: many(replies),
    subscriptions: many(userSubscriptions),
    activityParticipants: many(activityParticipants),
    pointTransactions: many(pointTransactions),
    userCards: many(userCards),
    userAchievements: many(userAchievements),
    redeemOrders: many(redeemOrders),
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

export const reactionsRelations = relations(reactions, ({ one }) => ({
    user: one(users, {
        fields: [reactions.userId],
        references: [users.id],
    }),
}))

export const repliesRelations = relations(replies, ({ one, many }) => ({
    author: one(users, {
        fields: [replies.userId],
        references: [users.id],
    }),
    parent: one(replies, {
        fields: [replies.parentId],
        references: [replies.id],
        relationName: 'reply_children',
    }),
    children: many(replies, {
        relationName: 'reply_children',
    }),
}))

export const userSubscriptionsRelations = relations(userSubscriptions, ({ one }) => ({
    user: one(users, {
        fields: [userSubscriptions.userId],
        references: [users.id],
    }),
}))

export const activitiesRelations = relations(activities, ({ many }) => ({
    participants: many(activityParticipants),
}))

export const activityParticipantsRelations = relations(activityParticipants, ({ one }) => ({
    activity: one(activities, {
        fields: [activityParticipants.activityId],
        references: [activities.id],
    }),
    user: one(users, {
        fields: [activityParticipants.userId],
        references: [users.id],
    }),
}))

export const pointTransactionsRelations = relations(pointTransactions, ({ one }) => ({
    user: one(users, {
        fields: [pointTransactions.userId],
        references: [users.id],
    }),
}))

export const cardsRelations = relations(cards, ({ many }) => ({
    userCards: many(userCards),
}))

export const userCardsRelations = relations(userCards, ({ one }) => ({
    user: one(users, {
        fields: [userCards.userId],
        references: [users.id],
    }),
    card: one(cards, {
        fields: [userCards.cardId],
        references: [cards.id],
    }),
}))

export const achievementsRelations = relations(achievements, ({ many }) => ({
    userAchievements: many(userAchievements),
}))

export const userAchievementsRelations = relations(userAchievements, ({ one }) => ({
    user: one(users, {
        fields: [userAchievements.userId],
        references: [users.id],
    }),
    achievement: one(achievements, {
        fields: [userAchievements.achievementId],
        references: [achievements.id],
    }),
}))

export const redeemItemsRelations = relations(redeemItems, ({ many }) => ({
    orders: many(redeemOrders),
}))

export const redeemOrdersRelations = relations(redeemOrders, ({ one }) => ({
    user: one(users, {
        fields: [redeemOrders.userId],
        references: [users.id],
    }),
    item: one(redeemItems, {
        fields: [redeemOrders.itemId],
        references: [redeemItems.id],
    }),
}))

export const dormCyclesRelations = relations(dormCycles, ({ many }) => ({
    questionnaires: many(dormQuestionnaires),
    rooms: many(dormRooms),
}))

export const dormQuestionnairesRelations = relations(dormQuestionnaires, ({ one }) => ({
    cycle: one(dormCycles, {
        fields: [dormQuestionnaires.cycleId],
        references: [dormCycles.id],
    }),
    user: one(users, {
        fields: [dormQuestionnaires.userId],
        references: [users.id],
    }),
}))

export const dormRoomsRelations = relations(dormRooms, ({ one }) => ({
    cycle: one(dormCycles, {
        fields: [dormRooms.cycleId],
        references: [dormCycles.id],
    }),
}))
