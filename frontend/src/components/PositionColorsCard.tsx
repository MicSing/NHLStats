import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import apiClient from '../services/apiClient'
import { useToast } from '../context/ToastContext'
import ColorSelect from './ColorSelect'

export interface PositionColor {
    position: 'LW' | 'C' | 'RW' | 'LD' | 'RD'
    color: string | null
}

/** Default ring colour per position. A season can change a user's colour, a match can change it again. */
export default function PositionColorsCard() {
    const { t } = useTranslation()
    const toast = useToast()
    const [rows, setRows] = useState<PositionColor[]>([])

    useEffect(() => {
        apiClient.get<PositionColor[]>('/api/admin/position-colors')
            .then((r) => setRows(Array.isArray(r) ? r.filter((x) => x && 'position' in x) : []))
            .catch(() => setRows([]))
    }, [])

    const change = async (position: PositionColor['position'], color: string | null) => {
        try {
            setRows(await apiClient.put<PositionColor[]>('/api/admin/position-colors', { colors: { [position]: color } }))
            toast.success(t('colors.saved'))
        } catch {
            toast.error(t('toast.operationFailed'))
        }
    }

    if (rows.length === 0) return null

    return (
        <div className="card p-4 mt-5">
            <h2 className="font-semibold mb-1">{t('colors.positionTitle')}</h2>
            <p className="text-sm text-text-muted mb-3">{t('colors.positionHint')}</p>
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
                {rows.map((r) => (
                    <label key={r.position} className="flex items-center gap-2 text-sm">
                        <span className="w-8 font-semibold">{r.position}</span>
                        <ColorSelect
                            value={r.color}
                            inheritLabel={t('colors.none')}
                            onChange={(c) => void change(r.position, c)}
                            ariaLabel={t('colors.colorFor', { name: r.position })}
                        />
                    </label>
                ))}
            </div>
        </div>
    )
}
