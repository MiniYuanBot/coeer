import { twMerge } from 'tailwind-merge'
import React from 'react'

interface SidebarProps {
  children?: React.ReactNode
  className?: string
}

export function Sidebar({children,className}:SidebarProps){
    const enhancedChildren=React.Children.map(children,(child)=>{
        if (React.isValidElement(child)){
            const element = child as React.ReactElement<{ className?: string }>
            const childClassName = twMerge(element.props.className, 'w-full justify-start')
            return React.cloneElement(element,{ className: childClassName})
        }
        return child
    })
    return (
        <aside
            className={twMerge('w-64 shrink-0 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 h-screen sticky top-0 overflow-y-auto',className)}
        >
            <nav className="p-4 space-y-1">{enhancedChildren}</nav>
        </aside>
    )
}