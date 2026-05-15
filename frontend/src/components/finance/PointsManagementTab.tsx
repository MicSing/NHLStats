import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import LoadingSpinner from '../LoadingSpinner'
import { useToast } from '../../context/ToastContext'
import apiClient from '../../services/apiClient'
import Pagination from '../Pagination'

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

const PAGE_SIZE = 20

export default function PointsManagementTab() {
    const { t } = useTranslation()
    const { success, error } = useToast()
    const [loading, setLoading] = useState(true)
    const [items, setItems] = useState<PointListItem[]>([])
    const [totalCount, setTotalCount] = useState(0)
    const [page, setPage] = useState(1)
    const [pointTypeFilter, setPointTypeFilter] = useState('')
    const [seasonFilter, setSeasonFilter] = useState('')
    const [userFilter, setUserFilter] = useState('')
    const [seasons, setSeasons] = useState<SeasonOption[]>([])
    const [users, setUsers] = useState<UserOption[]>([])
    const [editAmounts, setEditAmounts] = useState<Record<number, string>>({})
    const [saving, setSaving] = useState(false)

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
                pageSize: String(PAGE_SIZE),
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

    return (
        <div>
            <div className="flex flex-wrap gap-3 items-center mb-4">
                <label className="sr-only" htmlFor="season-filter">{t('points.season')}</label>
                <select
                    id="season-filter"
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
                    onClick={() => void saveAll()}
                    disabled={saving}
                    className="bg-primary hover:bg-primary-hover px-4 py-2 rounded text-sm font-medium disabled:opacity-50"
                >
                    {saving ? t('common.saving') : t('points.saveAll')}
                </button>
            </div>

            {loading ? (
                <div className="flex justify-center py-12">
                    <LoadingSpinner />
                </div>
            ) : (
                <>
                    <div className="overflow-x-auto rounded-xl border border-border overflow-hidden">
                        <table className="w-full text-sm">
                            <thead className="bg-surface">
                                <tr className="text-left text-text-muted uppercase text-xs tracking-wider">
                                    <th className="px-4 py-3 font-medium">{t('points.player')}</th>
                                    <th className="px-4 py-3 font-medium">{t('points.season')}</th>
                                    <th className="px-4 py-3 font-medium">{t('points.matchNumber')}</th>
                                    <th className="px-4 py-3 font-medium">{t('points.reason')}</th>
                                    <th className="px-4 py-3 font-medium">{t('points.type')}</th>
                                    <th className="px-4 py-3 font-medium text-right">{t('points.count')}</th>
                                    <th className="px-4 py-3 font-medium text-right">{t('points.amount')}</th>
                                    <th className="px-4 py-3 font-medium">{t('points.createdOn')}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {items.map((item) => (
                                    <tr key={item.id} className="hover:bg-surface/50 transition-colors group">
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
                                {items.length > 0 && (
                                    <tr className="bg-surface border-t-2 border-border font-semibold">
                                        <td className="px-4 py-3 text-text-muted uppercase text-xs tracking-wider" colSpan={5}>{t('points.totals')}</td>
                                        <td className="px-4 py-3 text-right">
                                            {items.reduce((s, i) => s + i.count, 0)}
                                        </td>
                                        <td className="px-4 py-3 text-right font-mono text-primary/80">
                                            {items.reduce((s, i) => s + i.amount, 0).toFixed(2)} €
                                        </td>
                                        <td className="px-4 py-3" />
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    <Pagination
                        currentPage={page}
                        totalItems={totalCount}
                        pageSize={PAGE_SIZE}
                        onPageChange={setPage}
                    />
                </>
            )}
        </div>
    )
}
