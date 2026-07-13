import { decimal, integer, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core'
import { users } from './users'
import { CARD_RARITY_ARRAY, CardRarity } from '@shared/constants'

export const cardRarityEnum = pgEnum('card_rarity', CARD_RARITY_ARRAY)

export const cards = pgTable('cards', {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 100 }).notNull(),
    description: text('description'),
    imageUrl: text('image_url').notNull(),
    rarity: cardRarityEnum('rarity').notNull(),
    series: varchar('series', { length: 100 }),
    dropRate: decimal('drop_rate', { precision: 5, scale: 4 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const userCards = pgTable('user_cards', {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
    cardId: uuid('card_id').references(() => cards.id, { onDelete: 'cascade' }).notNull(),
    count: integer('count').default(1).notNull(),
    obtainedAt: timestamp('obtained_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
    uniqueIndex('user_cards_user_card_unique').on(table.userId, table.cardId),
])

export type Card = typeof cards.$inferSelect & { rarity: CardRarity }
export type NewCard = typeof cards.$inferInsert & { rarity: CardRarity }
export type UserCard = typeof userCards.$inferSelect
export type NewUserCard = typeof userCards.$inferInsert

