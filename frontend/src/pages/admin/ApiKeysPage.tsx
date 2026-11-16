import { useEffect, useState } from 'react'
import { CopyIcon, KeyIcon } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import apiClient from '../../services/apiClient'
import AdminPageHeader from '../../components/AdminPageHeader'
import LoadingSpinner from '../../components/LoadingSpinner'
import ErrorMessage from '../../components/ErrorMessage'
import PositionColorsCard from '../../components/PositionColorsCard'
import { useToast } from '../../context/ToastContext'
import type { ApiKey, CreatedApiKey } from '../../types/collector'

/** API keys for machine clients such as the Collector app (X-Api-Key header). */
export default function ApiKeysPage() {
    const { t } = useTranslation()
    const toast = useToast()
    const [keys, setKeys] = useState<ApiKey[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [name, setName] = useState('')
    const [created, setCreated] = useState<CreatedApiKey | null>(null)

    const load = async () => {
        try {
            setKeys(await apiClient.get<ApiKey[]>('/api/admin/api-keys'))
        } catch {
            setError(t('errors.failedToLoadData'))
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        void load()
    }, []) // eslint-disable-line react-hooks/exhaustive-deps

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!name.trim()) return
        try {
            const result = await apiClient.post<CreatedApiKey>('/api/admin/api-keys', { name: name.trim() })
            setCreated(result)
            setName('')
            await load()
        } catch {
            toast.error(t('toast.operationFailed'))
        }
    }

    const handleRevoke = async (key: ApiKey) => {
        if (!window.confirm(t('apiKeys.revokeConfirm', { name: key.name }))) return
        try {
            await apiClient.delete(`/api/admin/api-keys/${key.id}`)
            await load()
        } catch {
            toast.error(t('toast.operationFailed'))
        }
    }

    const copy = async (value: string) => {
        try {
            await navigator.clipboard.writeText(value)
            toast.success(t('apiKeys.copied'))
        } catch {
            toast.error(t('toast.operationFailed'))
        }
    }

    const fmt = (d: string | null) => (d ? new Date(d).toLocaleString() : '–')

    if (loading) return <LoadingSpinner />
    if (error) return <ErrorMessage message={error} />

    return (
        <div>
            <AdminPageHeader title={t('apiKeys.title')} />
            <p className="text-sm text-text-muted mb-4">{t('apiKeys.description')}</p>

            <form onSubmit={(e) => void handleCreate(e)} className="card p-4 mb-5 flex flex-col sm:flex-row gap-2">
                <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t('apiKeys.namePlaceholder')}
                    aria-label={t('apiKeys.name')}
                    maxLength={100}
                    className="flex-1 bg-bg border border-border rounded px-3 py-2 text-sm"
                />
                <button type="submit" disabled={!name.trim()} className="bg-primary hover:bg-primary-hover rounded px-4 py-2 text-sm font-medium disabled:opacity-50">
                    {t('apiKeys.create')}
                </button>
            </form>

            {created && (
                <div className="card p-4 mb-5 border border-amber-500/50" role="alert">
                    <div className="flex items-center gap-2 font-semibold mb-1">
                        <KeyIcon size={16} className="text-amber-500" /> {t('apiKeys.createdTitle', { name: created.apiKey.name })}
                    </div>
                    <p className="text-sm text-text-muted mb-2">{t('apiKeys.createdHint')}</p>
                    <div className="flex gap-2 items-center">
                        <code className="flex-1 bg-bg border border-border rounded px-3 py-2 text-sm break-all" data-testid="new-api-key">{created.key}</code>
                        <button onClick={() => void copy(created.key)} className="flex items-center gap-1 border border-border hover:border-primary rounded px-3 py-2 text-sm">
                            <CopyIcon size={14} /> {t('apiKeys.copy')}
                        </button>
                    </div>
                    <button onClick={() => setCreated(null)} className="mt-2 text-sm text-text-muted hover:text-text">{t('apiKeys.hideKey')}</button>
                </div>
            )}

            <div className="card overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="text-left text-text-muted border-b border-border">
                            <th className="p-3">{t('apiKeys.name')}</th>
                            <th className="p-3">{t('apiKeys.prefix')}</th>
                            <th className="p-3">{t('apiKeys.created')}</th>
                            <th className="p-3">{t('apiKeys.lastUsed')}</th>
                            <th className="p-3">{t('apiKeys.status')}</th>
                            <th className="p-3"></th>
                        </tr>
                    </thead>
                    <tbody>
                        {keys.length === 0 && (
                            <tr><td colSpan={6} className="p-3 text-text-muted">{t('apiKeys.empty')}</td></tr>
                        )}
                        {keys.map((k) => (
                            <tr key={k.id} className="border-b border-border last:border-0">
                                <td className="p-3 font-medium">{k.name}</td>
                                <td className="p-3"><code>{k.prefix}…</code></td>
                                <td className="p-3">{fmt(k.createdAt)}</td>
                                <td className="p-3">{fmt(k.lastUsedAt)}</td>
                                <td className="p-3">
                                    {k.revokedAt
                                        ? <span className="text-red-500">{t('apiKeys.revoked')}</span>
                                        : <span className="text-green-500">{t('apiKeys.active')}</span>}
                                </td>
                                <td className="p-3 text-right">
                                    {!k.revokedAt && (
                                        <button onClick={() => void handleRevoke(k)} className="border border-red-500 text-red-500 hover:bg-red-500/10 rounded px-3 py-1 text-sm">
                                            {t('apiKeys.revoke')}
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <PositionColorsCard />
        </div>
    )
}
