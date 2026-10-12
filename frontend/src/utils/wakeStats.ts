// Remembers how long past backend/DB wake-ups took, so the waking screen can say how long
// the wait usually is. Browser-only on purpose: a server-side figure would only be readable
// once the DB is already awake, i.e. after it was needed.

const STORAGE_KEY = 'nhlstats.wakeDurations'
const MAX_ENTRIES = 10

export function readWakeDurations(): number[] {
    try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (!raw) return []
        const parsed: unknown = JSON.parse(raw)
        return Array.isArray(parsed)
            ? parsed.filter((v): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0)
            : []
    } catch {
        return []
    }
}

export function recordWakeDuration(ms: number): void {
    try {
        const next = [...readWakeDurations(), Math.round(ms)].slice(-MAX_ENTRIES)
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch {
        // storage unavailable (private mode, blocked) — the average is only a nicety
    }
}

export function averageWakeMs(durations: number[] = readWakeDurations()): number | null {
    if (durations.length === 0) return null
    return durations.reduce((sum, d) => sum + d, 0) / durations.length
}
