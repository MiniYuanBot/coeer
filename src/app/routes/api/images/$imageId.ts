import { createFileRoute } from '@tanstack/react-router'
import { readImage } from '~/services/ImageService'

export const Route = createFileRoute('/api/images/$imageId')({
    server: { handlers: {
        GET: ({ params }) => readImage(params.imageId),
        HEAD: ({ params }) => readImage(params.imageId, true),
    } },
})
