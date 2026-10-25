import type { ComponentProps, HTMLAttributes, ReactNode } from 'react'
import { cn } from '../lib/cn'
import { SectionHeader } from './SectionHeader'
import { FilterPanel, type FilterGroup, type FilterPanelProps } from './FilterPanel'

export type PageLayoutProps = HTMLAttributes<HTMLElement> & {
    as?: 'div' | 'section' | 'article'
    description?: ComponentProps<typeof SectionHeader>['description']
    action?: ReactNode
    level?: ComponentProps<typeof SectionHeader>['level']
    actionLayout?: ComponentProps<typeof SectionHeader>['actionLayout']
    /** Specialized welcome/navigation headers for pages such as home and spaces. */
    header?: ReactNode
    scope?: FilterGroup
    filters?: Omit<FilterPanelProps, 'scope' | 'className'>
    busy?: boolean
}

/** One page composition: header/actions → scope → search → filters → content.
 * Optional regions collapse without leaving empty toolbars or extra spacing.
 * Business state and navigation remain owned by each route.
 */
export function PageLayout({ as: Container = 'div', className, title, description, action, level, actionLayout, header, scope, filters, busy, children, ...props }: PageLayoutProps) {
    return <Container {...props} aria-busy={busy ?? props['aria-busy']} className={cn('coeer-page', className)}>
        {header ?? (title && <SectionHeader title={title} description={description} action={action} level={level} actionLayout={actionLayout} />)}
        {(scope || filters) && <FilterPanel {...filters} scope={scope} />}
        {children}
    </Container>
}
