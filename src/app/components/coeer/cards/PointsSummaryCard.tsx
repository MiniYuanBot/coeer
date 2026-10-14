import { Link } from '@tanstack/react-router'
import { Card } from '../ui/Card'
import { Icon } from '../ui/Icon'

export function PointsSummaryCard({ balance = 0, streak }: { balance?: number; streak?: number }) {
    return (
        <Card className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground"><Icon name="coins" className="h-3.5 w-3.5" />我的积分</div>
            <div className="mt-3 flex items-end justify-between gap-3">
                <span className="text-[28px] font-semibold tabular-nums leading-none tracking-tight">{balance.toLocaleString('zh-CN')}</span>
                <Link to="/redeems" className="coeer-focus rounded text-xs text-primary hover:underline">兑换权益</Link>
            </div>
            <p className="mt-3 text-xs leading-5 text-muted-foreground">{streak !== undefined ? '连续活跃 ' + streak + ' 天。' : '参与活动、提交反馈，积累成长积分。'}</p>
        </Card>
    )
}
