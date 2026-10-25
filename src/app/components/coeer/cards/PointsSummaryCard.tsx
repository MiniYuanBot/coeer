import { Link } from '@tanstack/react-router'
import { Card } from '../ui/Card'
import { Icon } from '../ui/Icon'

export function PointsSummaryCard({ balance = null, streak, showHelp = true }: { balance?: number | null; streak?: number; showHelp?: boolean }) {
    return (
        <Card className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground"><Icon name="coins" className="h-3.5 w-3.5" />我的积分</div>
            <div className="mt-3 flex items-end justify-between gap-3">
                <span className="text-[28px] font-semibold tabular-nums leading-none">{balance === null ? '—' : balance.toLocaleString('zh-CN')}</span>
                <Link to="/redeems" className="coeer-focus rounded text-xs text-primary hover:underline">兑换权益</Link>
            </div>
            {(showHelp || balance === null) && <p className="mt-3 text-xs leading-5 text-muted-foreground">{balance === null ? '暂时无法读取积分，请刷新页面重试。' : streak !== undefined ? '连续活跃 ' + streak + ' 天。' : '参与活动、提交反馈，积累成长积分。'}</p>}
        </Card>
    )
}
