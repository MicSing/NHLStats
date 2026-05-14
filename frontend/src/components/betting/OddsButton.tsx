interface OddsButtonProps {
    label: string
    subLabel: string
    odds: number | null
    disabled?: boolean
    onClick: () => void
}

export default function OddsButton({ label, subLabel, odds, disabled, onClick }: OddsButtonProps) {
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className="flex-1 border border-border bg-bg rounded-lg p-3 text-center hover:border-primary hover:bg-primary/5 disabled:opacity-30 disabled:hover:border-border disabled:hover:bg-bg transition-colors"
        >
            <p className="text-[10px] font-bold uppercase text-text-muted">{label}</p>
            <p className="text-xs text-text-muted truncate">{subLabel}</p>
            <p className="text-lg font-bold mt-1">{odds != null ? `×${odds.toFixed(2)}` : '—'}</p>
        </button>
    )
}
