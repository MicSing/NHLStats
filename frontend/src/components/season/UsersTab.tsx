import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Trash } from '@phosphor-icons/react'
import type { Season, SeasonDetail } from '../../types/season'
import type { User } from '../../types/user'
import apiClient from '../../services/apiClient'
import { useToast } from '../../context/ToastContext'
import LoadingSpinner from '../LoadingSpinner'
import { TableCard, PrimaryButton } from './SeasonPrimitives'

export interface UsersTabProps {
    season: Season
    allUsers: User[]
    seasonDetail: SeasonDetail | null
    onRefreshDetail: () => void
}

export default function UsersTab({ season, allUsers, seasonDetail, onRefreshDetail }: UsersTabProps) {
    const { t } = useTranslation()
    const toast = useToast()
    const [assignUserId, setAssignUserId] = useState<number | ''>('')

    const handleAssignUser = async () => {
        if (assignUserId === '') return
        try {
            await apiClient.post(`/api/seasons/${season.id}/users/${assignUserId}`, {})
            setAssignUserId('')
            onRefreshDetail()
        } catch {
            toast.error(t('toast.operationFailed'))
        }
    }

    const handleRemoveUser = async (userId: number) => {
        try {
            await apiClient.delete(`/api/seasons/${season.id}/users/${userId}`)
            onRefreshDetail()
        } catch {
            toast.error(t('toast.operationFailed'))
        }
    }

    const assignableUsers = allUsers.filter(
        (u) => !seasonDetail?.users.some((su) => su.id === u.id),
    )

    if (!seasonDetail) return <LoadingSpinner size="sm" inline />

    return (
        <div className="max-w-xl space-y-4">
            <TableCard>
                <table className="w-full text-sm">
                    <thead className="bg-surface">
                        <tr className="text-left text-text-muted text-xs uppercase tracking-wider">
                            <th className="px-4 py-3 font-medium">{t('common.name')}</th>
                            <th className="px-4 py-3 font-medium text-right">{t('common.actions')}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {seasonDetail.users.length === 0 ? (
                            <tr>
                                <td colSpan={2} className="px-4 py-6 text-center text-text-muted text-sm">
                                    {t('admin.seasons.noUsersAssigned')}
                                </td>
                            </tr>
                        ) : (
                            seasonDetail.users.map((u) => (
                                <tr key={u.id} className="hover:bg-surface/50 transition-colors">
                                    <td className="px-4 py-3">{u.name}</td>
                                    <td className="px-4 py-3 text-right">
                                        <button
                                            onClick={() => void handleRemoveUser(u.id)}
                                            className="p-1.5 text-text-muted hover:text-red-400 hover:bg-red-900/20 rounded transition-colors"
                                            title={t('common.remove')}
                                        >
                                            <Trash size={15} />
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </TableCard>

            {assignableUsers.length > 0 && (
                <div className="flex gap-2">
                    <select
                        aria-label="Select user to assign"
                        value={assignUserId}
                        onChange={(e) =>
                            setAssignUserId(e.target.value === '' ? '' : Number(e.target.value))
                        }
                        className="flex-1 bg-border border border-border rounded px-3 py-2 text-sm"
                    >
                        <option value="">{t('admin.seasons.selectUser')}</option>
                        {assignableUsers.map((u) => (
                            <option key={u.id} value={u.id}>
                                {u.name}
                            </option>
                        ))}
                    </select>
                    <PrimaryButton
                        label={t('common.assign')}
                        onClick={() => void handleAssignUser()}
                        disabled={assignUserId === ''}
                    />
                </div>
            )}
        </div>
    )
}
