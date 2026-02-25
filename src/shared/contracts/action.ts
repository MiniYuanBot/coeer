export type ActionState<S extends string = string> = {
    code: S
    message?: string // user friendly message
}

// Define the response for server actions,
// like createServerFn / form action / etc
// Status is given string key
// like 'SUCCESS' / 'SERVER_ERROR'
export type ActionResponse<T = void, S extends string = string> = {
    success: boolean
    data?: T
    state: ActionState<S>
}

// Response for paginated actions
export type PaginatedActionResponse<T, S extends string = string> = {
    success: boolean
    data?: {
        items?: T[] // returning items
        total?: number // total items in the database
        page?: number // now page
        pageSize?: number // size per page
    }
    state: ActionState<S>
}