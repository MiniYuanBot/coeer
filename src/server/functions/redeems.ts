import { createServerFn } from '@tanstack/react-start'
import {
    CreateRedeemItemSchema,
    ListRedeemItemsSchema,
    ListRedeemOrdersSchema,
    ProcessRedeemOrderSchema,
    RedeemItemSchema,
    RedeemOrderIdSchema,
    RedeemItemIdSchema,
    UpdateRedeemItemSchema,
} from '@shared/contracts'
import { RedeemService } from '../services'

export const listRedeemItemsFn = createServerFn({ method: 'GET' })
    .inputValidator(ListRedeemItemsSchema)
    .handler(async ({ data }) => RedeemService.listItems(data))

export const redeemItemFn = createServerFn({ method: 'POST' })
    .inputValidator(RedeemItemSchema)
    .handler(async ({ data }) => {
        const result = await RedeemService.redeem(data)
        if (!result.success) {
            throw new Error(result.state.message || '兑换失败')
        }
        return result.data
    })

export const getMyRedeemOrdersFn = createServerFn({ method: 'GET' })
    .inputValidator(ListRedeemOrdersSchema)
    .handler(async ({ data }) => RedeemService.listMyOrders(data))

export const adminListRedeemOrdersFn = createServerFn({ method: 'GET' })
    .inputValidator(ListRedeemOrdersSchema)
    .handler(async ({ data }) => RedeemService.adminListOrders(data))

export const getRedeemOrderDetailsFn = createServerFn({ method: 'GET' })
    .inputValidator(RedeemOrderIdSchema)
    .handler(async ({ data }) => RedeemService.getOrder(data))

export const adminCreateRedeemItemFn = createServerFn({ method: 'POST' })
    .inputValidator(CreateRedeemItemSchema)
    .handler(async ({ data }) => RedeemService.adminCreateItem(data))

export const adminUpdateRedeemItemFn = createServerFn({ method: 'POST' })
    .inputValidator(UpdateRedeemItemSchema)
    .handler(async ({ data }) => RedeemService.adminUpdateItem(data))

export const adminDeleteRedeemItemFn = createServerFn({ method: 'POST' })
    .inputValidator(RedeemItemIdSchema)
    .handler(async ({ data }) => RedeemService.adminDeleteItem(data))

export const adminProcessRedeemOrderFn = createServerFn({ method: 'POST' })
    .inputValidator(ProcessRedeemOrderSchema)
    .handler(async ({ data }) => RedeemService.adminProcessOrder(data))
