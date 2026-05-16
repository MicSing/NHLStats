import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

type StatusBadgeVariant = 'success' | 'warning' | 'muted' | 'primary' | 'secondary' | 'danger'

const variantClasses: Record<StatusBadgeVariant, string> = {
    success: 'bg-green-500/15 text-success border-green-500/30',
    warning: 'bg-amber-500/15 text-warning border-amber-500/30',
    muted: 'bg-gray-500/20 text-text-muted border-gray-500/30',
    primary: 'bg-blue-500/15 text-primary border-blue-500/30',
    secondary: 'bg-rose-500/15 text-secondary border-rose-500/30',
    danger: 'bg-red-500/15 text-danger border-red-500/30',
}

const statusVariantMap: Record<string, StatusBadgeVariant> = {
    Positive: 'success',
    Negative: 'danger',
    Neutral: 'muted',
    Active: 'primary',
    Inactive: 'muted',
    Won: 'success',
    Lost: 'danger',
    Pending: 'primary',
    Cancelled: 'muted',
    Admin: 'secondary',
    Participant: 'muted',
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
        Won: t('betting.outcomeWon'),
        Lost: t('betting.outcomeLost'),
        Pending: t('betting.outcomePending'),
        Cancelled: t('betting.outcomeCancelled'),
    }

    const resolvedVariant = status ? (statusVariantMap[status] ?? 'muted') : variant!
    const resolvedLabel = status ? (statusLabelMap[status] ?? status) : children

    return (
        <span className={`text-[10px] px-2.5 py-1 rounded border font-semibold uppercase tracking-widest ${variantClasses[resolvedVariant]}`}>
            {resolvedLabel}
        </span>
    )
}
