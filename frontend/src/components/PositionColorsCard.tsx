import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import apiClient from '../services/apiClient'
import { useToast } from '../context/ToastContext'

export interface PositionColor {
    position: 'LW' | 'C' | 'RW' | 'LD' | 'RD'
    color: string | null
}

/** Colours the Collector can look for; keep in sync with PositionColorService and collector/rings.py. */
const COLORS: Record<string, string> = {
    red: '#e5484d', orange: '#f76b15', yellow: '#ffe629', green: '#30a46c', cyan: '#00c2d7', blue: '#3e63dd', pink: '#d6409f',
}

/** Ring colour the game draws under each user position, read by the Collector to tell users apart. */
export default function PositionColorsCard() {
    const { t } = useTranslation()
    const toast = useToast()
    const [rows, setRows] = useState<PositionColor[]>([])

    useEffect(() => {
        apiClient.get<PositionColor[]>('/api/admin/position-colors')
            .then((r) => setRows(Array.isArray(r) ? r.filter((x) => x && 'position' in x) : []))
            .catch(() => setRows([]))
    }, [])

    const change = async (position: PositionColor['position'], color: string) => {
        try {
            const updated = await apiClient.put<PositionColor[]>('/api/admin/position-colors', { colors: { [position]: color || null } })
            setRows(updated)
            toast.success(t('apiKeys.colorsSaved'))
        } catch {
            toast.error(t('toast.operationFailed'))
        }
    }

    if (rows.length === 0) return null

    return (
        <div className="card p-4 mt-5">
            <h2 className="font-semibold mb-1">{t('apiKeys.colorsTitle')}</h2>
            <p className="text-sm text-text-muted mb-3">{t('apiKeys.colorsHint')}</p>
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
                {rows.map((r) => {
                    const swatch = r.color ? (COLORS[r.color] ?? r.color) : 'transparent'
                    return (
                        <label key={r.position} className="flex items-center gap-2 text-sm">
                            <span className="w-8 font-semibold">{r.position}</span>
                            <span className="w-4 h-4 rounded-full border-2 border-border shrink-0" style={{ borderColor: swatch }} aria-hidden />
                            <select
                                aria-label={t('apiKeys.colorFor', { position: r.position })}
                                value={r.color ?? ''}
                                onChange={(e) => void change(r.position, e.target.value)}
                                className="flex-1 bg-bg border border-border rounded px-2 py-1"
                            >
                                <option value="">{t('apiKeys.noColor')}</option>
                                {Object.keys(COLORS).map((c) => <option key={c} value={c}>{t(`apiKeys.color.${c}`)}</option>)}
                                {r.color && !(r.color in COLORS) && <option value={r.color}>{r.color}</option>}
                            </select>
                        </label>
                    )
                })}
            </div>
        </div>
    )
}
