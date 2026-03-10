import type { ReactNode } from 'react'

interface AdminPageHeaderProps {
    title: string
    action?: {
        label: string
        onClick: () => void
    }
    children?: ReactNode
}

export default function AdminPageHeader({ title, action, children }: AdminPageHeaderProps) {
    return (
        <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-primary">{title}</h1>
            {children ?? (action && (
                <button
                    onClick={action.onClick}
                    className="bg-primary hover:bg-primary-hover px-4 py-2 rounded text-sm font-medium"
                >
                    {action.label}
                </button>
            ))}
        </div>
    )
}
