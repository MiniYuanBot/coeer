import * as React from 'react'
import type { SessionUser } from '../lib/types'
import { TopNav } from './TopNav'

export function AppShell({ user, children }: { user: SessionUser; children: React.ReactNode }) {
    return (
        <>
            <TopNav user={user} />
            <main className="coeer-container py-6 md:py-8">{children}</main>
        </>
    )
}
