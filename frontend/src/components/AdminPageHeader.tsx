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
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
            <h1 className="text-xl sm:text-2xl font-bold text-primary">{title}</h1>
            {children ?? (action && (
                <button
                    onClick={action.onClick}
                    className="bg-primary hover:bg-primary-hover px-3.5 sm:px-4 py-2 rounded text-sm font-medium w-full sm:w-auto text-center"
                >
                    {action.label}
                </button>
            ))}
        </div>
    )
}
