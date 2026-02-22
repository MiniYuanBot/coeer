// Define the response for server actions,
// like createServerFn / form action / etc
// Status is given string key
// like 'SUCCESS' / 'SERVER_ERROR'
export type ActionResponse<T = void, S extends string = string> = {
    success: boolean
    data?: T
    status: S
    message?: string // user frindly message
}

// Response for paginated actions
export type PaginatedActionResponse<T, S extends string = string> = {
    items: T[]
    total: number
    page?: number
    pageSize?: number
    status: S
    message?: string
}