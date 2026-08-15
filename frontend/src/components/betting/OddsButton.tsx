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
            className="flex-1 min-w-0 border border-border bg-bg rounded-lg p-2 sm:p-3 text-center hover:border-primary hover:bg-primary/5 disabled:opacity-30 disabled:hover:border-border disabled:hover:bg-bg transition-colors"
        >
            <p className="text-[9px] sm:text-[10px] font-bold uppercase text-text-muted">{label}</p>
            <p className="text-[11px] sm:text-xs text-text-muted truncate">{subLabel}</p>
            <p className="text-base sm:text-lg font-bold mt-0.5 sm:mt-1">{odds != null ? `×${odds.toFixed(2)}` : '—'}</p>
        </button>
    )
}
