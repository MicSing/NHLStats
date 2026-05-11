import { CompletionType } from '../types/match'

export default function CompletionBadge({ type }: { type: CompletionType }) {
    const map: Record<CompletionType, { label: string; className: string }> = {
        [CompletionType.None]: { label: 'N/A', className: 'bg-border text-text-muted' },
        [CompletionType.RegularTime]: { label: 'REG', className: 'bg-success/20 text-success' },
        [CompletionType.Overtime]: { label: 'OT', className: 'bg-warning/20 text-warning' },
        [CompletionType.Shootout]: { label: 'SO', className: 'bg-secondary/20 text-secondary' },
        [CompletionType.InProgress]: { label: 'LIVE', className: 'bg-danger/20 text-danger animate-pulse' },
    }
    const { label, className } = map[type] ?? map[CompletionType.None]
    return (
        <span className={`text-xs px-2 py-0.5 rounded font-medium ${className}`}>{label}</span>
    )
}
