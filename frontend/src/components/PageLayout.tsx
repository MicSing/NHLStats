import type { ReactNode } from 'react'

interface PageLayoutProps {
    children: ReactNode
    className?: string
}

export default function PageLayout({ children, className }: PageLayoutProps) {
    return (
        <div className={`min-h-screen bg-bg text-text px-2 py-4 sm:p-6${className ? ` ${className}` : ''}`}>
            {children}
        </div>
    )
}
