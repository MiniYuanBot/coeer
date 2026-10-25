import { index, integer, pgEnum, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'
import { users } from './users'
import { POINT_SOURCE_ARRAY, POINT_TRANSACTION_TYPE_ARRAY, PointSource, PointTransactionType } from '@shared/constants'

export const pointTransactionTypeEnum = pgEnum('point_transaction_type', POINT_TRANSACTION_TYPE_ARRAY)
export const pointSourceEnum = pgEnum('point_source', POINT_SOURCE_ARRAY)

export const pointTransactions = pgTable('point_transactions', {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
    amount: integer('amount').notNull(),
    type: pointTransactionTypeEnum('type').notNull(),
    source: pointSourceEnum('source').notNull(),
    description: varchar('description', { length: 200 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
    index('point_transactions_user_created_idx').on(table.userId, table.createdAt.desc(), table.id.desc()),
    index('point_transactions_user_type_source_created_idx').on(table.userId, table.type, table.source, table.createdAt),
])

export type PointTransaction = typeof pointTransactions.$inferSelect & {
    type: PointTransactionType
    source: PointSource
}
export type NewPointTransaction = typeof pointTransactions.$inferInsert & {
    type: PointTransactionType
    source: PointSource
}

