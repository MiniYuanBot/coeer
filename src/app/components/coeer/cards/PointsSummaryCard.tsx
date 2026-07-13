import { Card } from '../ui/Card'
import { Icon } from '../ui/Icon'

export function PointsSummaryCard({ balance = 0, streak = 7 }: { balance?: number; streak?: number }) {
    return (
        <Card className="p-5">
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-sm text-[hsl(var(--muted-foreground))]">我的积分</p>
                    <div className="mt-2 text-3xl font-bold text-[hsl(var(--primary))]">{balance}</div>
                </div>
                <div className="grid h-12 w-12 place-items-center rounded-lg bg-[hsl(var(--primary)/0.1)] text-[hsl(var(--primary))]">
                    <Icon name="coins" className="h-5 w-5" />
                </div>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-[hsl(var(--muted))]">
                <div className="h-full rounded-full bg-[hsl(var(--primary))]" style={{ width: `${Math.min(100, Math.max(12, balance / 8))}%` }} />
            </div>
            <p className="mt-3 text-xs text-[hsl(var(--muted-foreground))]">连续活跃 {streak} 天，完成反馈和活动可以继续成长。</p>
        </Card>
    )
}
