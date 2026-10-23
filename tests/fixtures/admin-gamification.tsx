import { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Route as Achievements } from '../../src/app/routes/_authed/admin/achievements'
import { Route as Redeems } from '../../src/app/routes/_authed/admin/redeems'
import { AchievementCard } from '../../src/app/components/coeer/cards/AchievementCard'
import { failure, submitted } from './admin-gamification-actions'
import '../../src/app/styles/app.css'

function Fixture() {
    const [, refresh] = useState(0)
    useEffect(() => {
        const update = () => refresh((value) => value + 1)
        window.addEventListener('admin-submitted', update)
        return () => window.removeEventListener('admin-submitted', update)
    }, [])
    const kind = new URLSearchParams(window.location.search).get('kind')
    const Page = (kind === 'achievements' ? Achievements : Redeems).options.component!
    return <main className="coeer-workspace max-w-5xl p-4">
        <Page />
        <output id="submitted-action">{submitted.action}</output>
        <output id="submitted-data">{JSON.stringify(submitted.data)}</output>
        <select aria-label="模拟保存失败" onChange={(event) => { failure.mode = event.target.value }}>
            <option value="">正常提交</option><option value="response">服务器拒绝</option><option value="network">网络中断</option>
        </select>
        <section id="achievement-card"><AchievementCard unlocked achievement={{ name: '图片成就', description: '说明', iconUrl: '/demo/card-common.svg' }} /></section>
    </main>
}
createRoot(document.getElementById('root')!).render(<Fixture />)
