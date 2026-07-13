import * as React from 'react'
import { Button } from '../ui/Button'
import { Icon } from '../ui/Icon'

export function ThemeToggle() {
    const [dark, setDark] = React.useState(false)

    React.useEffect(() => {
        const saved = localStorage.getItem('coeer-theme')
        const next = saved ? saved === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches
        document.documentElement.classList.toggle('dark', next)
        setDark(next)
    }, [])

    return (
        <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="切换主题"
            onClick={() => {
                const next = !dark
                document.documentElement.classList.toggle('dark', next)
                localStorage.setItem('coeer-theme', next ? 'dark' : 'light')
                setDark(next)
            }}
        >
            <Icon name={dark ? 'sun' : 'moon'} />
        </Button>
    )
}
