import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import LoadingSpinner from '../../components/LoadingSpinner'
import { useToast } from '../../context/ToastContext'
import apiClient from '../../services/apiClient'

interface PointListItem {
    id: number
    userMatchId: number
    userName: string | null
    matchNumber: number
    seasonName: string | null
    pointReasonName: string | null
    pointType: string
    count: number
    amount: number
    createdOn: string | null
}

interface PagedResponse {
    items: PointListItem[]
    totalCount: number
}

interface SeasonOption {
    id: number
    name: string
}

interface UserOption {
    id: number
    name: string
}

export default function PointsManagementPage() {
    const { t } = useTranslation()
    const { success, error } = useToast()
    const [loading, setLoading] = useState(true)
    const [items, setItems] = useState<PointListItem[]>([])
    const [totalCount, setTotalCount] = useState(0)
    const [page, setPage] = useState(1)
    const [pointTypeFilter, setPointTypeFilter] = useState<string>('')
    const [seasonFilter, setSeasonFilter] = useState<string>('')
    const [userFilter, setUserFilter] = useState<string>('')
    const [seasons, setSeasons] = useState<SeasonOption[]>([])
    const [users, setUsers] = useState<UserOption[]>([])
    const [editAmounts, setEditAmounts] = useState<Record<number, string>>({})
    const [saving, setSaving] = useState(false)
    const pageSize = 20

    useEffect(() => {
        void Promise.all([
            apiClient.get<SeasonOption[]>('/api/seasons'),
            apiClient.get<UserOption[]>('/api/users'),
        ]).then(([s, u]) => {
            setSeasons(s)
            setUsers(u)
        })
    }, [])

    const load = useCallback(async () => {
        setLoading(true)
        try {
            const params = new URLSearchParams({
                page: String(page),
                pageSize: String(pageSize),
            })
            if (pointTypeFilter) params.set('pointType', pointTypeFilter)
            if (seasonFilter) params.set('seasonId', seasonFilter)
            if (userFilter) params.set('userId', userFilter)
            const data = await apiClient.get<PagedResponse>(`/api/admin/points?${params}`)
            setItems(data.items)
            setTotalCount(data.totalCount)
            const amounts: Record<number, string> = {}
            for (const item of data.items) {
                amounts[item.id] = String(item.amount)
            }
            setEditAmounts(amounts)
        } catch {
            error(t('points.loadError'))
        } finally {
            setLoading(false)
        }
    }, [page, pointTypeFilter, seasonFilter, userFilter, error, t])

    useEffect(() => { void load() }, [load])

    const handleAmountChange = (id: number, value: string) => {
        setEditAmounts((prev) => ({ ...prev, [id]: value }))
    }

    const saveAll = async () => {
        const changed = items.filter((item) => {
            const edited = parseFloat(editAmounts[item.id] ?? '')
            return !Number.isNaN(edited) && edited !== item.amount
        })

        if (changed.length === 0) {
            error(t('points.noChanges'))
            return
        }

        setSaving(true)
        try {
            await apiClient.put('/api/admin/points/bulk', {
                items: changed.map((item) => ({
                    id: item.id,
                    amount: parseFloat(editAmounts[item.id]),
                })),
            })
            success(t('points.saved'))
            await load()
        } catch {
            error(t('points.saveError'))
        } finally {
            setSaving(false)
        }
    }

    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold">{t('points.title')}</h1>
                    <p className="text-sm text-text-muted mt-1">{t('points.subtitle')}</p>
                </div>
                <div className="flex flex-wrap gap-3 items-center">
                    <label className="sr-only" htmlFor="season-filter">{t('points.season')}</label>
                    <select
                        id="season-filter"
                        aria-label={t('points.season')}
                        value={seasonFilter}
                        onChange={(e) => { setSeasonFilter(e.target.value); setPage(1) }}
                        className="px-3 py-1.5 rounded border border-border bg-surface text-sm"
                    >
                        <option value="">{t('points.allSeasons')}</option>
                        {seasons.map((s) => (
                            <option key={s.id} value={String(s.id)}>{s.name}</option>
                        ))}
                    </select>
                    <label className="sr-only" htmlFor="player-filter">{t('points.player')}</label>
                    <select
                        id="player-filter"
                        aria-label={t('points.player')}
                        value={userFilter}
                        onChange={(e) => { setUserFilter(e.target.value); setPage(1) }}
                        className="px-3 py-1.5 rounded border border-border bg-surface text-sm"
                    >
                        <option value="">{t('points.allPlayers')}</option>
                        {users.map((u) => (
                            <option key={u.id} value={String(u.id)}>{u.name}</option>
                        ))}
                    </select>
                    <select
                        value={pointTypeFilter}
                        onChange={(e) => { setPointTypeFilter(e.target.value); setPage(1) }}
                        className="px-3 py-1.5 rounded border border-border bg-surface text-sm"
                    >
                        <option value="">{t('points.allTypes')}</option>
                        <option value="Positive">{t('points.positive')}</option>
                        <option value="Negative">{t('points.negative')}</option>
                    </select>
                    <button
                        onClick={saveAll}
                        disabled={saving}
                        className="px-5 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors font-semibold text-sm disabled:opacity-50"
                    >
                        {saving ? t('common.saving') : t('points.saveAll')}
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center py-12">
                    <LoadingSpinner />
                </div>
            ) : (
                <>
                    <div className="overflow-x-auto rounded-xl border border-border">
                        <table className="w-full text-sm">
                            <thead className="bg-surface text-text-muted uppercase text-xs tracking-wider">
                                <tr>
                                    <th className="text-left px-4 py-3">{t('points.player')}</th>
                                    <th className="text-left px-4 py-3">{t('points.season')}</th>
                                    <th className="text-left px-4 py-3">{t('points.matchNumber')}</th>
                                    <th className="text-left px-4 py-3">{t('points.reason')}</th>
                                    <th className="text-left px-4 py-3">{t('points.type')}</th>
                                    <th className="text-right px-4 py-3">{t('points.count')}</th>
                                    <th className="text-right px-4 py-3">{t('points.amount')}</th>
                                    <th className="text-left px-4 py-3">{t('points.createdOn')}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {items.length > 0 && (
                                    <tr className="bg-surface font-semibold text-xs uppercase tracking-wide border-b-2 border-border">
                                        <td className="px-4 py-2 text-text-muted" colSpan={5}>{t('points.totals')}</td>
                                        <td className="px-4 py-2 text-right">
                                            {items.reduce((s, i) => s + i.count, 0)}
                                        </td>
                                        <td className="px-4 py-2 text-right">
                                            {items.reduce((s, i) => s + i.amount, 0).toFixed(2)} €
                                        </td>
                                        <td className="px-4 py-2" />
                                    </tr>
                                )}
                                {items.map((item) => (
                                    <tr key={item.id} className="bg-bg hover:bg-surface transition-colors">
                                        <td className="px-4 py-3 font-medium">{item.userName ?? '—'}</td>
                                        <td className="px-4 py-3 text-text-muted text-xs">{item.seasonName ?? '—'}</td>
                                        <td className="px-4 py-3 text-text-muted">#{item.matchNumber}</td>
                                        <td className="px-4 py-3">{item.pointReasonName ?? '—'}</td>
                                        <td className="px-4 py-3">
                                            <span
                                                className={`text-xs px-2 py-0.5 rounded font-medium ${
                                                    item.pointType === 'Positive'
                                                        ? 'bg-success/20 text-success'
                                                        : 'bg-danger/20 text-danger'
                                                }`}
                                            >
                                                {item.pointType}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-right">{item.count}</td>
                                        <td className="px-4 py-3 text-right">
                                            <input
                                                type="number"
                                                step={0.01}
                                                value={editAmounts[item.id] ?? ''}
                                                onChange={(e) => handleAmountChange(item.id, e.target.value)}
                                                className="w-24 px-2 py-1 rounded border border-border bg-bg text-right text-sm"
                                            />
                                            <span className="ml-1 text-text-muted">€</span>
                                        </td>
                                        <td className="px-4 py-3 text-text-muted text-xs">
                                            {item.createdOn ? new Date(item.createdOn).toLocaleDateString() : '—'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-text-muted">
                                {t('points.showing', { from: (page - 1) * pageSize + 1, to: Math.min(page * pageSize, totalCount), total: totalCount })}
                            </span>
                            <div className="flex gap-2">
                                <button
                                    disabled={page === 1}
                                    onClick={() => setPage((p) => p - 1)}
                                    className="px-3 py-1.5 rounded border border-border text-sm disabled:opacity-40 hover:bg-surface transition-colors"
                                >
                                    {t('common.previous')}
                                </button>
                                <span className="px-3 py-1.5">{page} / {totalPages}</span>
                                <button
                                    disabled={page === totalPages}
                                    onClick={() => setPage((p) => p + 1)}
                                    className="px-3 py-1.5 rounded border border-border text-sm disabled:opacity-40 hover:bg-surface transition-colors"
                                >
                                    {t('common.next')}
                                </button>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    )
}
