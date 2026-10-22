import { createServerFn } from '@tanstack/react-start'
import { ListBookmarksSchema, SetBookmarkSchema } from '@shared/contracts/bookmarks'
import { BookmarkService } from '../services/BookmarkService'

export const setBookmarkFn = createServerFn({ method: 'POST' }).inputValidator(SetBookmarkSchema)
    .handler(({ data }) => BookmarkService.set(data))
export const listBookmarksFn = createServerFn({ method: 'GET' }).inputValidator(ListBookmarksSchema)
    .handler(({ data }) => BookmarkService.list(data))
