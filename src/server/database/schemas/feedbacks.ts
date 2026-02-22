import { pgTable, varchar, text, timestamp, boolean, uuid, json, pgEnum } from 'drizzle-orm/pg-core'
import { users } from './users';

export const FEEDBACK_STATUSES = ['pending', 'processing', 'resolved', 'invalid'] as const;
export type FeedbackStatus = typeof FEEDBACK_STATUSES[number];
export const feedbackStatusEnum = pgEnum('feedback_status', FEEDBACK_STATUSES);

export const TARGET_TYPES = ['academic', 'office', 'general'] as const;
export type TargetType = typeof TARGET_TYPES[number];
export const targetTypeEnum = pgEnum('target_type', TARGET_TYPES);

export const feedbacks = pgTable('feedbacks', {
    id: uuid('id').defaultRandom().primaryKey(),
    authorId: uuid('author_id')
        .references(() => users.id)
        .notNull(),

    // feedback target
    targetType: targetTypeEnum('target_type').notNull(),
    targetDesc: varchar('target_desc', { length: 255 }).notNull(),

    // content
    title: varchar('title', { length: 255 }).notNull(),
    content: text('content').notNull(),
    isAnonymous: boolean('is_anonymous').default(false).notNull(),

    status: feedbackStatusEnum('status').default('pending').notNull(),

    resolvedAt: timestamp('resolved_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// export const feedbackStatusLogs = pgTable('feedback_status_logs', {
//     id: uuid('id').defaultRandom().primaryKey(),
//     feedbackId: uuid('feedback_id')
//         .references(() => feedbacks.id, { onDelete: 'cascade' })
//         .notNull(),
//     status: feedbackStatusEnum('status').notNull(),
//     changedBy: uuid('changed_by')
//         .references(() => users.id)
//         .notNull(),
//     note: text('note'),
//     createdAt: timestamp('created_at').defaultNow().notNull(),
// });

// export const feedbackViews = pgTable('feedback_views', {
//     id: uuid('id').defaultRandom().primaryKey()
//     feedbackId: uuid('feedback_id')
//         .references(() => feedbacks.id, { onDelete: 'cascade' })
//         .notNull()
//         .unique(),
//     viewCount: text('view_count').default('0').notNull(),
//     lastViewedAt: timestamp('last_viewed_at'),
// });

export type Feedback = typeof feedbacks.$inferSelect;
export type NewFeedback = typeof feedbacks.$inferInsert;

// export type FeedbackStatusLog = typeof feedbackStatusLogs.$inferSelect;
// export type NewFeedbackStatusLog = typeof feedbackStatusLogs.$inferInsert;

// export type FeedbackView = typeof feedbackViews.$inferSelect;
// export type NewFeedbackView = typeof feedbackViews.$inferInsert;