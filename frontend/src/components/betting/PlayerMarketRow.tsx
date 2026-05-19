interface PlayerMarketRowProps {
    name: string
    odds: number | null
    forceDisabled?: boolean
    occasionsBadge?: number
    onAdd: () => void
}

export default function PlayerMarketRow({ name, odds, forceDisabled, occasionsBadge, onAdd }: PlayerMarketRowProps) {
    return (
        <button
            onClick={onAdd}
            disabled={forceDisabled || odds == null || odds < 1}
            className="w-full flex justify-between items-center px-3 py-2 border border-border rounded bg-bg hover:border-primary hover:bg-primary/5 disabled:opacity-30 disabled:hover:border-border disabled:hover:bg-bg transition-colors"
        >
            <span className="flex items-center gap-1.5 text-sm">
                {name}
                {occasionsBadge != null && (
                    <span className="text-[10px] font-bold px-1 py-0.5 rounded bg-primary/15 text-primary leading-none">
                        ×{occasionsBadge}
                    </span>
                )}
            </span>
            <span className="font-bold text-warning">{odds != null ? `×${odds.toFixed(2)}` : '—'}</span>
        </button>
    )
}
