import { useState } from 'react'

/**
 * Tracks which users are highlighted in a multi-line chart.
 * `null` means nothing is highlighted (all lines drawn normally).
 * Clicking a user toggles them in/out of the highlighted set.
 */
export function useHighlightedUsers(totalUsers: number) {
    const [highlighted, setHighlighted] = useState<Set<string> | null>(null)

    function toggleUser(userName: string) {
        setHighlighted((prev) => {
            if (prev === null) return new Set([userName])
            const next = new Set(prev)
            if (next.has(userName)) {
                next.delete(userName)
                if (next.size === 0) return null
            } else {
                next.add(userName)
                if (next.size === totalUsers) return null
            }
            return next
        })
    }

    const isHighlighted = (userName: string) => highlighted === null || highlighted.has(userName)

    /** Props to spread onto a recharts <Line> so highlighted users stand out. */
    const lineProps = (userName: string) => {
        const active = isHighlighted(userName)
        const focused = highlighted !== null && active
        return {
            strokeWidth: focused ? 3.5 : 2,
            strokeOpacity: active ? 1 : 0.15,
            style: { cursor: 'pointer' },
            onClick: () => toggleUser(userName),
        }
    }

    /** Props to spread onto a recharts <Legend> for click-to-highlight. */
    const legendProps = {
        onClick: (entry: { value?: unknown }) => toggleUser(String(entry.value)),
        formatter: (value: string) => (
            <span
                style={{
                    opacity: isHighlighted(value) ? 1 : 0.4,
                    fontWeight: highlighted !== null && isHighlighted(value) ? 700 : undefined,
                    cursor: 'pointer',
                }}
            >
                {value}
            </span>
        ),
    }

    return { highlighted, toggleUser, isHighlighted, lineProps, legendProps }
}
