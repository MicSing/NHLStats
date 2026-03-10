import type { ReactNode } from 'react'

interface PageLayoutProps {
    children: ReactNode
    className?: string
}

export default function PageLayout({ children, className }: PageLayoutProps) {
    return (
        <div className={`min-h-screen bg-bg text-text p-6${className ? ` ${className}` : ''}`}>
            {children}
        </div>
    )
}
