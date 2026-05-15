import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

type StatusBadgeVariant = 'success' | 'warning' | 'muted' | 'primary' | 'secondary' | 'danger'

const variantClasses: Record<StatusBadgeVariant, string> = {
    success: 'bg-success/20 text-success',
    warning: 'bg-warning/20 text-warning',
    muted: 'bg-border text-text-muted',
    primary: 'bg-primary/20 text-primary',
    secondary: 'bg-secondary/20 text-secondary',
    danger: 'bg-danger/20 text-danger',
}

const statusVariantMap: Record<string, StatusBadgeVariant> = {
    Positive: 'primary',
    Negative: 'warning',
    Neutral: 'muted',
    Active: 'success',
    Inactive: 'muted',
}

type StatusBadgeProps =
    | { status: string; variant?: never; children?: never }
    | { variant: StatusBadgeVariant; children: ReactNode; status?: never }

export default function StatusBadge({ variant, status, children }: StatusBadgeProps) {
    const { t } = useTranslation()

    const statusLabelMap: Record<string, string> = {
        Positive: t('common.positive'),
        Negative: t('common.negative'),
        Neutral: t('common.neutral'),
        Active: t('common.active'),
        Inactive: t('common.inactive'),
    }

    const resolvedVariant = status ? (statusVariantMap[status] ?? 'muted') : variant!
    const resolvedLabel = status ? (statusLabelMap[status] ?? status) : children

    return (
        <span className={`text-xs px-2 py-1 rounded-full ${variantClasses[resolvedVariant]}`}>
            {resolvedLabel}
        </span>
    )
}
