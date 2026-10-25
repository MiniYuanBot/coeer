import { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Route as Achievements } from '../../src/app/routes/_authed/admin/achievements/index'
import { Route as Redeems } from '../../src/app/routes/_authed/admin/redeems/index'
import { Route as Cards } from '../../src/app/routes/_authed/admin/cards/index'
import { Route as CreateAchievement } from '../../src/app/routes/_authed/admin/achievements/create'
import { Route as EditAchievement } from '../../src/app/routes/_authed/admin/achievements/$achievementId.edit'
import { Route as CreateItem } from '../../src/app/routes/_authed/admin/redeems/create'
import { Route as EditItem } from '../../src/app/routes/_authed/admin/redeems/$itemId.edit'
import { Route as CreateCard } from '../../src/app/routes/_authed/admin/cards/create'
import { Route as EditCard } from '../../src/app/routes/_authed/admin/cards/$cardId.edit'
import { useFixturePath } from './admin-navigation'
import { Route as Collection } from '../../src/app/routes/_authed/cards/index'
import { Route as FrontAchievements } from '../../src/app/routes/_authed/achievements/index'
import { CollectibleCard } from '../../src/app/components/coeer/cards/CollectibleCard'
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
    const path = useFixturePath()
    const routes = kind === 'cards' ? [Cards, CreateCard, EditCard] : kind === 'achievements' ? [Achievements, CreateAchievement, EditAchievement] : [Redeems, CreateItem, EditItem]
    const Page = (kind === 'collection' ? Collection : kind === 'frontAchievements' ? FrontAchievements : routes[path.includes('/create') ? 1 : path.includes('/edit') ? 2 : 0]).options.component!
    return <main className="coeer-workspace max-w-5xl p-4">
        <Page key={path} />
        <output id="submitted-action">{submitted.action}</output>
        <output id="submitted-data">{JSON.stringify(submitted.data)}</output>
        <select aria-label="模拟保存失败" onChange={(event) => { failure.mode = event.target.value }}>
            <option value="">正常提交</option><option value="response">服务器拒绝</option><option value="network">网络中断</option>
        </select>
        <section id="achievement-card"><AchievementCard unlocked achievement={{ name: '图片成就', description: '说明', iconUrl: '/demo/card-common.svg' }} /></section>
        <section id="collectible-card" className="max-w-xs"><CollectibleCard card={{ name: '收藏卡面', imageUrl: '/demo/card-common.svg', rarity: 'common' }} /></section>
    </main>
}
createRoot(document.getElementById('root')!).render(<Fixture />)
