import { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { GroupReplies } from '../../src/app/components/coeer/cards/GroupReplies'
import { configureChronologyFixture, initialize, roots, state } from './reply-actions'
import '../../src/app/styles/app.css'

initialize()

function Discussion() {
    const [, refresh] = useState(0)
    const [rootCreated, setRootCreated] = useState(false)
    useEffect(() => {
        const reload = () => refresh((value) => value + 1)
        window.addEventListener('reload-replies', reload)
        return () => window.removeEventListener('reload-replies', reload)
    }, [])
    return <main className="mx-auto max-w-4xl p-4">
        <GroupReplies postId="post" replies={roots()} total={state.items.length} userId="me" canReply canManage
            onRootCreated={async () => setRootCreated(true)} />
        <button onClick={() => { state.failNextLoad = true }}>模拟下次加载失败</button>
        <button onClick={configureChronologyFixture}>模拟乱序回复</button>
        <output id="last-parent">{state.lastParent}</output>
        <output id="root-created">{String(rootCreated)}</output>
    </main>
}

createRoot(document.getElementById('root')!).render(<Discussion />)
