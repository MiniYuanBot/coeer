import { createServerFn } from '@tanstack/react-start'
import {
    CreateRedeemItemSchema,
    ListRedeemItemsSchema,
    ListRedeemOrdersSchema,
    ProcessRedeemOrderSchema,
    RedeemItemSchema,
    RedeemOrderIdSchema,
} from '@shared/contracts'
import { RedeemService } from '../services'

export const listRedeemItemsFn = createServerFn({ method: 'GET' })
    .inputValidator(ListRedeemItemsSchema)
    .handler(async ({ data }) => RedeemService.listItems(data))

export const redeemItemFn = createServerFn({ method: 'POST' })
    .inputValidator(RedeemItemSchema)
    .handler(async ({ data }) => RedeemService.redeem(data))

export const getMyRedeemOrdersFn = createServerFn({ method: 'GET' })
    .inputValidator(ListRedeemOrdersSchema)
    .handler(async ({ data }) => RedeemService.listMyOrders(data))

export const getRedeemOrderDetailsFn = createServerFn({ method: 'GET' })
    .inputValidator(RedeemOrderIdSchema)
    .handler(async ({ data }) => RedeemService.getOrder(data))

export const adminCreateRedeemItemFn = createServerFn({ method: 'POST' })
    .inputValidator(CreateRedeemItemSchema)
    .handler(async ({ data }) => RedeemService.adminCreateItem(data))

export const adminProcessRedeemOrderFn = createServerFn({ method: 'POST' })
    .inputValidator(ProcessRedeemOrderSchema)
    .handler(async ({ data }) => RedeemService.adminProcessOrder(data))

