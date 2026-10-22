import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { MediaPreview } from '../../src/app/components/coeer/ui/MediaPreview'
import '../../src/app/styles/app.css'

function Preview() {
    const [src, setSrc] = useState('/missing-demo.svg')
    return <main className="mx-auto max-w-3xl space-y-5 p-5">
        <div id="legacy" className="grid grid-cols-2 gap-4">
            {['COEER+Common', 'COEER+Rare', 'COEER+Legendary', 'Sticker', 'Ticket', 'Bag'].map((name) =>
                <div key={name} className="coeer-card overflow-hidden"><MediaPreview src={`https://placehold.co/512x512?text=${name}`} alt={name} /></div>)}
        </div>
        <div id="custom"><MediaPreview src="https://images.example.test/custom.svg" alt="自定义图片" /></div>
        <div id="recover"><MediaPreview src={src} alt="恢复后的图片" /></div>
        <button onClick={() => setSrc('/demo/card-common.svg')}>加载有效图片</button>
    </main>
}

createRoot(document.getElementById('root')!).render(<Preview />)
