import { integer, pgEnum, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'
import { users } from './users'
import {
    REDEEM_ITEM_STATUS_ARRAY,
    REDEEM_ITEM_TYPE_ARRAY,
    REDEEM_ORDER_STATUS_ARRAY,
    RedeemItemStatus,
    RedeemItemType,
    RedeemOrderStatus,
} from '@shared/constants'

export const redeemItemTypeEnum = pgEnum('redeem_item_type', REDEEM_ITEM_TYPE_ARRAY)
export const redeemItemStatusEnum = pgEnum('redeem_item_status', REDEEM_ITEM_STATUS_ARRAY)
export const redeemOrderStatusEnum = pgEnum('redeem_order_status', REDEEM_ORDER_STATUS_ARRAY)

export const redeemItems = pgTable('redeem_items', {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 100 }).notNull(),
    description: text('description'),
    imageUrl: text('image_url'),
    pointsCost: integer('points_cost').notNull(),
    stock: integer('stock').default(-1).notNull(),
    type: redeemItemTypeEnum('type').notNull(),
    status: redeemItemStatusEnum('status').default('active').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const redeemOrders = pgTable('redeem_orders', {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
    itemId: uuid('item_id').references(() => redeemItems.id, { onDelete: 'restrict' }).notNull(),
    status: redeemOrderStatusEnum('status').default('pending').notNull(),
    redeemCode: varchar('redeem_code', { length: 100 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
})

export type RedeemItem = typeof redeemItems.$inferSelect & { type: RedeemItemType, status: RedeemItemStatus }
export type NewRedeemItem = typeof redeemItems.$inferInsert & { type: RedeemItemType, status?: RedeemItemStatus }
export type RedeemOrder = typeof redeemOrders.$inferSelect & { status: RedeemOrderStatus }
export type NewRedeemOrder = typeof redeemOrders.$inferInsert & { status?: RedeemOrderStatus }

