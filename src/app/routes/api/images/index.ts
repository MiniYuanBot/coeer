import { createFileRoute } from '@tanstack/react-router'
import { uploadImage } from '~/services/ImageService'

export const Route = createFileRoute('/api/images/')({
    server: { handlers: { POST: ({ request }) => uploadImage(request) } },
})
