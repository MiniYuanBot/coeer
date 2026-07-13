import { cn } from '../lib/cn'
import { Badge } from '../ui/Badge'
import { Card } from '../ui/Card'
import { Icon } from '../ui/Icon'

export function AchievementCard({ achievement, unlocked }: { achievement: any; unlocked?: boolean }) {
    const item = achievement.achievement ?? achievement
    return (
        <Card className={cn('p-5', !unlocked && 'opacity-75')}>
            <div className="flex items-start gap-4">
                <div className={cn('grid h-12 w-12 place-items-center rounded-lg', unlocked ? 'bg-[hsl(var(--primary)/0.1)] text-[hsl(var(--primary))]' : 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]')}>
                    <Icon name="award" className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                    <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{item.name}</h3>
                        {unlocked ? <Badge tone="success">已解锁</Badge> : <Badge>未解锁</Badge>}
                    </div>
                    <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">{item.description}</p>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-[hsl(var(--muted))]">
                        <div className="h-full rounded-full bg-[hsl(var(--primary))]" style={{ width: unlocked ? '100%' : '36%' }} />
                    </div>
                </div>
            </div>
        </Card>
    )
}
