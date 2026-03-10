import type { ReactNode } from 'react'

type StatusBadgeVariant = 'success' | 'warning' | 'muted' | 'primary' | 'secondary' | 'danger'

const variantClasses: Record<StatusBadgeVariant, string> = {
    success: 'bg-success/20 text-success',
    warning: 'bg-warning/20 text-warning',
    muted: 'bg-border text-text-muted',
    primary: 'bg-primary/20 text-primary',
    secondary: 'bg-secondary/20 text-secondary',
    danger: 'bg-danger/20 text-danger',
}

interface StatusBadgeProps {
    variant: StatusBadgeVariant
    children: ReactNode
}

export default function StatusBadge({ variant, children }: StatusBadgeProps) {
    return (
        <span className={`text-xs px-2 py-1 rounded-full ${variantClasses[variant]}`}>
            {children}
        </span>
    )
}
