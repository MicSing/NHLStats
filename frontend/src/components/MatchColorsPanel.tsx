import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import apiClient from '../services/apiClient'
import { useToast } from '../context/ToastContext'
import ColorSelect, { Swatch } from './ColorSelect'
import { useColorName } from './ringColors'

export interface MatchUserColor {
    userId: number
    name: string
    position: string | null
    color: string | null
    source: 'match' | 'season' | 'position' | null
    seasonColor: string | null
}

/** Ring colour of each user in this match: the season colour unless changed for this match. */
export default function MatchColorsPanel({ matchId }: { matchId: number }) {
    const { t } = useTranslation()
    const toast = useToast()
    const name = useColorName()
    const [rows, setRows] = useState<MatchUserColor[]>([])
    const [open, setOpen] = useState(false)

    useEffect(() => {
        apiClient.get<MatchUserColor[]>(`/api/matches/${matchId}/colors`)
            .then((r) => setRows(Array.isArray(r) ? r : []))
            .catch(() => setRows([]))
    }, [matchId])

    const change = async (userId: number, color: string | null) => {
        try {
            setRows(await apiClient.put<MatchUserColor[]>(`/api/matches/${matchId}/users/${userId}/color`, { color }))
        } catch {
            toast.error(t('toast.operationFailed'))
        }
    }

    if (rows.length === 0) return null

    return (
        <div className="card p-4 mb-5">
            <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between text-left" aria-expanded={open}>
                <span className="font-semibold">{t('colors.matchTitle')}</span>
                <span className="flex gap-1">{rows.map((r) => <Swatch key={r.userId} color={r.color} />)}</span>
            </button>
            {open && (
                <div className="mt-3 space-y-2">
                    <p className="text-sm text-text-muted">{t('colors.matchHint')}</p>
                    {rows.map((r) => (
                        <div key={r.userId} className="flex items-center gap-3 text-sm">
                            <span className="w-40 truncate">{r.name}{r.position ? <span className="text-text-muted"> · {r.position}</span> : null}</span>
                            <ColorSelect
                                value={r.source === 'match' ? r.color : null}
                                inherited={r.seasonColor}
                                inheritLabel={t('colors.fromSeason', { color: name(r.seasonColor) })}
                                onChange={(c) => void change(r.userId, c)}
                                ariaLabel={t('colors.colorFor', { name: r.name })}
                            />
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
