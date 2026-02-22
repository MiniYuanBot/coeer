import { pgTable, varchar, text, timestamp, boolean, uuid, json, pgEnum } from 'drizzle-orm/pg-core'
import { users } from './users';
import { FEEDBACK_TARGET_TYPES_ARRAY, FeedbackTargetTypes, FEEDBACK_STATUSES_ARRAY, FeedbackStatuses } from '@shared/constants'


export const feedbackStatusEnum = pgEnum('feedback_status', FEEDBACK_STATUSES_ARRAY);

export const targetTypeEnum = pgEnum('target_type', FEEDBACK_TARGET_TYPES_ARRAY);

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

export type Feedback = typeof feedbacks.$inferSelect & { targetType: FeedbackTargetTypes, status: FeedbackStatuses };
export type NewFeedback = typeof feedbacks.$inferInsert & { targetType: FeedbackTargetTypes, status: FeedbackStatuses };

// export type FeedbackStatusLog = typeof feedbackStatusLogs.$inferSelect;
// export type NewFeedbackStatusLog = typeof feedbackStatusLogs.$inferInsert;

// export type FeedbackView = typeof feedbackViews.$inferSelect;
// export type NewFeedbackView = typeof feedbackViews.$inferInsert;