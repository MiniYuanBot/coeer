import { cn } from '../lib/cn'
import { Badge } from '../ui/Badge'
import { Card } from '../ui/Card'
import { Icon } from '../ui/Icon'

export function AchievementCard({ achievement, unlocked }: { achievement: any; unlocked?: boolean }) {
    const item = achievement.achievement ?? achievement
    return (
        <Card className="rounded-lg p-5">
            <div className="flex items-start gap-4">
                <div className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-lg', unlocked ? 'bg-primary-soft text-[hsl(var(--primary))]' : 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]')}>
                    {item.iconUrl ? <img src={item.iconUrl} alt={item.name} width={40} height={40} loading="lazy" decoding="async" className="h-10 w-10 rounded-lg object-contain" /> : <Icon name="award" className="h-5 w-5" />}
                </div>
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <h3 className="break-words text-[15px] font-medium">{item.name}</h3>
                        {unlocked ? <Badge tone="success">已解锁</Badge> : <Badge>未解锁</Badge>}
                    </div>
                    <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-[hsl(var(--muted-foreground))]">{item.description}</p>
                    <div role="progressbar" aria-label={`${item.name}解锁进度`} aria-valuemin={0} aria-valuemax={100}
                        aria-valuenow={unlocked ? 100 : Math.max(0, Math.min(100, item.progress?.percentage ?? 0))}
                        className="mt-3 h-2 overflow-hidden rounded-full bg-[hsl(var(--muted))]">
                        <div className="h-full rounded-full bg-[hsl(var(--primary))]" style={{ width: unlocked ? '100%' : `${Math.max(0, Math.min(100, item.progress?.percentage ?? 0))}%` }} />
                    </div>
                    {item.progress ? <p className="mt-1 text-xs tabular-nums text-muted-foreground">{item.progress.current} / {item.progress.target}</p> : null}
                </div>
            </div>
        </Card>
    )
}
