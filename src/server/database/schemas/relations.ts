import { relations } from 'drizzle-orm/relations'
import { feedbacks, users } from './index'

export const feedbacksRelations = relations(feedbacks, ({ one }) => ({
    author: one(users, {
        fields: [feedbacks.authorId],
        references: [users.id],
    }),
}))

export const usersRelations = relations(users, ({ many }) => ({
    feedbacks: many(feedbacks),
}))