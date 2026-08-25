interface OddsButtonProps {
    label: string
    subLabel?: string
    odds: number | null
    disabled?: boolean
    onClick: () => void
    title?: string
}

export default function OddsButton({ label, subLabel, odds, disabled, onClick, title }: OddsButtonProps) {
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            title={title || subLabel || label}
            className="flex-1 min-w-0 border border-border bg-bg rounded-lg p-2 sm:p-3 text-center hover:border-primary hover:bg-primary/5 disabled:opacity-30 disabled:hover:border-border disabled:hover:bg-bg transition-colors flex flex-col justify-between items-center"
        >
            <div className="w-full flex flex-col items-center">
                <p className="text-[10px] sm:text-xs font-bold uppercase text-text-muted">{label}</p>
                {subLabel && (
                    <p className="text-[11px] sm:text-xs text-text-muted leading-tight mt-1 break-words text-center">
                        {subLabel}
                    </p>
                )}
            </div>
            <p className="text-sm sm:text-lg font-bold text-text mt-1 sm:mt-1.5">{odds != null ? `×${odds.toFixed(2)}` : '—'}</p>
        </button>
    )
}
