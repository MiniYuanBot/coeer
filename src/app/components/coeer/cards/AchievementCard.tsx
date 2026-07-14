import { cn } from '../lib/cn'
import { Badge } from '../ui/Badge'
import { Card } from '../ui/Card'
import { Icon } from '../ui/Icon'

export function AchievementCard({ achievement, unlocked }: { achievement: any; unlocked?: boolean }) {
    const item = achievement.achievement ?? achievement
    return (
        <Card className={cn('rounded-xl p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-[hsl(var(--border))] hover:shadow-sm', !unlocked && 'opacity-60 grayscale')}>
            <div className="flex items-start gap-4">
                <div className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-[10px]', unlocked ? 'bg-[hsl(var(--primary)/0.08)] text-[hsl(var(--primary))]' : 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]')}>
                    <Icon name="award" className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                    <div className="flex items-center gap-2">
                        <h3 className="text-[15px] font-medium">{item.name}</h3>
                        {unlocked ? <Badge tone="success">已解锁</Badge> : <Badge>未解锁</Badge>}
                    </div>
                    <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-[hsl(var(--muted-foreground))]">{item.description}</p>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-[hsl(var(--muted))]">
                        <div className="h-full rounded-full bg-[hsl(var(--primary))]" style={{ width: unlocked ? '100%' : '36%' }} />
                    </div>
                </div>
            </div>
        </Card>
    )
}
