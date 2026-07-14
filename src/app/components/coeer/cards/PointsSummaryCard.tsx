import { Card } from '../ui/Card'
import { Icon } from '../ui/Icon'

export function PointsSummaryCard({ balance = 0, streak = 7 }: { balance?: number; streak?: number }) {
    return (
        <Card className="rounded-xl p-5">
            <div className="flex items-center justify-between">
                <div>
                    <div className="text-[32px] font-medium tabular-nums leading-none text-[hsl(var(--primary))]">{balance}</div>
                    <p className="mt-2 text-[13px] text-[hsl(var(--muted-foreground))]">我的积分</p>
                </div>
                <div className="grid h-10 w-10 place-items-center rounded-[10px] bg-[hsl(var(--primary)/0.08)] text-[hsl(var(--primary))]">
                    <Icon name="coins" className="h-5 w-5" />
                </div>
            </div>
            <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-[hsl(var(--muted))]">
                <div className="h-full rounded-full bg-[hsl(var(--primary))]" style={{ width: `${Math.min(100, Math.max(12, balance / 8))}%` }} />
            </div>
            <p className="mt-3 text-[13px] text-[hsl(var(--muted-foreground))]">连续活跃 {streak} 天，完成反馈和活动可以继续成长。</p>
        </Card>
    )
}
