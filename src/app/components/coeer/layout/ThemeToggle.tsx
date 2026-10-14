import * as React from 'react'
import { Button } from '../ui/Button'
import { Icon } from '../ui/Icon'

export function ThemeToggle() {
    const [dark, setDark] = React.useState(false)
    React.useEffect(() => {
        const sync = () => setDark(document.documentElement.classList.contains('dark'))
        sync()
        const observer = new MutationObserver(sync)
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
        return () => observer.disconnect()
    }, [])
    return (
        <Button type="button" variant="ghost" size="icon"
            aria-label={dark ? '切换到浅色主题' : '切换到深色主题'}
            title={dark ? '切换到浅色主题' : '切换到深色主题'} aria-pressed={dark}
            onClick={() => {
                const next = !document.documentElement.classList.contains('dark')
                document.documentElement.classList.toggle('dark', next)
                setDark(next)
                try { localStorage.setItem('coeer-theme', next ? 'dark' : 'light') } catch { /* Theme still works without storage. */ }
            }}>
            <Icon name={dark ? 'sun' : 'moon'} />
        </Button>
    )
}
