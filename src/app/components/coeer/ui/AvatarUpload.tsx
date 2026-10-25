import { useState, type FormEvent } from 'react'
import { useRouter } from '@tanstack/react-router'
import { MAX_AVATAR_BYTES } from '@shared/images'
import { Button } from './Button'
import { ImageUploadField, uploadFormImage } from './ImageUploadField'

export function AvatarUpload({ src }: { src?: string | null }) {
    const router = useRouter()
    const [pending, setPending] = useState(false)
    const [selected, setSelected] = useState(false)
    const [savedSrc, setSavedSrc] = useState(src)
    const [notice, setNotice] = useState<{ success: boolean; message: string }>()
    async function upload(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        if (!selected || pending) return
        const form = new FormData(event.currentTarget)
        setNotice(undefined)
        setPending(true)
        try {
            const url = await uploadFormImage(form, 'avatar', 'avatar')
            if (!url) throw new Error('请先选择头像')
            setSavedSrc(url)
            setSelected(false)
            await router.invalidate()
            setNotice({ success: true, message: '头像已更新' })
        } catch (error) {
            setNotice({ success: false, message: error instanceof Error ? error.message : '上传失败，请重试' })
        } finally { setPending(false) }
    }
    return <form onSubmit={event => void upload(event)} className="space-y-4">
        <ImageUploadField key={savedSrc} name="avatar" label="头像图片" defaultValue={savedSrc} preset="avatar"
            maxBytes={MAX_AVATAR_BYTES} allowUrl={false} allowRemove={false} disabled={pending}
            onFileChange={file => { setSelected(!!file); setNotice(undefined) }} />
        <Button type="submit" loading={pending} disabled={!selected}>保存头像</Button>
        {notice && <p role={notice.success ? 'status' : 'alert'} className={notice.success ? 'text-sm text-primary' : 'text-sm text-danger'}>{notice.message}</p>}
    </form>
}
