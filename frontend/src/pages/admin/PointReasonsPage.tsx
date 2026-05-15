import { useEffect, useState } from 'react'
import { PencilSimple, Prohibit, Plus, CheckCircle } from '@phosphor-icons/react'
import type { PointReason, PointType, CreatePointReasonDto, UpdatePointReasonDto } from '../../types/pointReason'
import apiClient from '../../services/apiClient'
import Modal from '../../components/Modal'
import { useTranslation } from 'react-i18next'
import LoadingSpinner from '../../components/LoadingSpinner'
import ErrorMessage from '../../components/ErrorMessage'
import StatusBadge from '../../components/StatusBadge'
import SearchInput from '../../components/SearchInput'
import Pagination from '../../components/Pagination'
import useTable from '../../hooks/useTable'
import { useToast } from '../../context/ToastContext'

export default function PointReasonsPage() {
    const { t } = useTranslation()
    const toast = useToast()
    const [reasons, setReasons] = useState<PointReason[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const [showAddModal, setShowAddModal] = useState(false)
    const [addForm, setAddForm] = useState<CreatePointReasonDto>({ name: '', pointType: 'Negative' })

    const [editReason, setEditReason] = useState<PointReason | null>(null)
    const [editForm, setEditForm] = useState<UpdatePointReasonDto>({
        name: '',
        pointType: 'Negative',
        isActive: true,
    })

    const { pageItems, totalFiltered, search, setSearch, currentPage, setCurrentPage } = useTable({
        data: reasons,
        searchFields: (r) => [r.name],
    })

    const loadReasons = async () => {
        try {
            const data = await apiClient.get<PointReason[]>('/api/pointreasons')
            setReasons(data)
        } catch {
            setError(t('errors.failedToLoadPointReasons'))
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        void loadReasons()
    }, [])

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault()
        try {
            await apiClient.post<PointReason>('/api/pointreasons', addForm)
            setShowAddModal(false)
            setAddForm({ name: '', pointType: 'Negative' })
            toast.success(t('toast.createSuccess'))
            await loadReasons()
        } catch {
            toast.error(t('toast.operationFailed'))
        }
    }

    const openEdit = (reason: PointReason) => {
        setEditReason(reason)
        setEditForm({ name: reason.name, pointType: reason.pointType, isActive: reason.isActive })
    }

    const handleEdit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!editReason) return
        try {
            await apiClient.put<PointReason>(`/api/pointreasons/${editReason.id}`, editForm)
            setEditReason(null)
            toast.success(t('toast.saveSuccess'))
            await loadReasons()
        } catch {
            toast.error(t('toast.operationFailed'))
        }
    }

    const handleDeactivate = async (reason: PointReason) => {
        try {
            await apiClient.put<PointReason>(`/api/pointreasons/${reason.id}`, {
                name: reason.name,
                pointType: reason.pointType,
                isActive: false,
            } satisfies UpdatePointReasonDto)
            toast.success(t('toast.saveSuccess'))
            await loadReasons()
        } catch {
            toast.error(t('toast.operationFailed'))
        }
    }

    const handleActivate = async (reason: PointReason) => {
        try {
            await apiClient.put<PointReason>(`/api/pointreasons/${reason.id}`, {
                name: reason.name,
                pointType: reason.pointType,
                isActive: true,
            } satisfies UpdatePointReasonDto)
            toast.success(t('toast.saveSuccess'))
            await loadReasons()
        } catch {
            toast.error(t('toast.operationFailed'))
        }
    }

    if (loading) return <LoadingSpinner />
    if (error) return <ErrorMessage message={error} onRetry={() => void loadReasons()} />

    return (
        <div className="flex flex-col h-full">
            <header className="h-16 border-b border-border bg-surface flex items-center justify-between px-8 shrink-0">
                <h1 className="text-lg font-semibold">{t('admin.pointReasons.title')}</h1>
                <div className="flex items-center gap-4">
                    <SearchInput value={search} onChange={setSearch} placeholder={t('common.search')} />
                    <button
                        onClick={() => setShowAddModal(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-hover rounded-md text-sm font-medium transition-colors shadow-sm"
                    >
                        <Plus size={16} />
                        {t('admin.pointReasons.addReason')}
                    </button>
                </div>
            </header>

            <div className="flex-1 p-8 overflow-y-auto">
                <div className="overflow-x-auto rounded-xl border border-border overflow-hidden">
                    <table className="w-full text-sm">
                        <thead className="bg-surface">
                            <tr className="text-left text-text-muted uppercase text-xs tracking-wider">
                                <th className="px-4 py-3 font-medium">{t('common.name')}</th>
                                <th className="px-4 py-3 font-medium">{t('common.type')}</th>
                                <th className="px-4 py-3 font-medium">{t('common.status')}</th>
                                <th className="px-4 py-3 font-medium text-right">{t('common.actions')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {pageItems.map((reason) => (
                                <tr
                                    key={reason.id}
                                    className="hover:bg-surface/50 transition-colors group"
                                >
                                    <td className="px-4 py-3 font-medium">{reason.name}</td>
                                    <td className="px-4 py-3">
                                        <StatusBadge status={reason.pointType} />
                                    </td>
                                    <td className="px-4 py-3">
                                        <StatusBadge status={reason.isActive ? 'Active' : 'Inactive'} />
                                    </td>
                                    <td className="px-4 py-3 text-right w-24">
                                        <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => openEdit(reason)}
                                                className="p-1.5 text-text-muted hover:text-text hover:bg-border rounded transition-colors"
                                                title={t('common.edit')}
                                            >
                                                <PencilSimple size={16} />
                                            </button>
                                            {reason.isActive ? (
                                                <button
                                                    onClick={() => void handleDeactivate(reason)}
                                                    className="p-1.5 text-text-muted hover:text-warning hover:bg-warning/10 rounded transition-colors"
                                                    title={t('common.deactivate')}
                                                >
                                                    <Prohibit size={16} />
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={() => void handleActivate(reason)}
                                                    className="p-1.5 text-text-muted hover:text-primary hover:bg-primary/10 rounded transition-colors"
                                                    title={t('common.activate')}
                                                >
                                                    <CheckCircle size={16} />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="mt-4">
                    <Pagination
                        currentPage={currentPage}
                        totalItems={totalFiltered}
                        pageSize={20}
                        onPageChange={setCurrentPage}
                    />
                </div>
            </div>

            {showAddModal && (
                <Modal title={t('admin.pointReasons.addTitle')} onClose={() => setShowAddModal(false)}>
                    <PointReasonForm
                        name={addForm.name}
                        pointType={addForm.pointType}
                        showIsActive={false}
                        isActive={true}
                        onNameChange={(v) => setAddForm((f) => ({ ...f, name: v }))}
                        onPointTypeChange={(v) => setAddForm((f) => ({ ...f, pointType: v }))}
                        onIsActiveChange={() => { }}
                        onSubmit={(e) => void handleAdd(e)}
                        onCancel={() => setShowAddModal(false)}
                    />
                </Modal>
            )}

            {editReason && (
                <Modal title={t('admin.pointReasons.editReason')} onClose={() => setEditReason(null)}>
                    <PointReasonForm
                        name={editForm.name}
                        pointType={editForm.pointType}
                        showIsActive={true}
                        isActive={editForm.isActive}
                        onNameChange={(v) => setEditForm((f) => ({ ...f, name: v }))}
                        onPointTypeChange={(v) => setEditForm((f) => ({ ...f, pointType: v }))}
                        onIsActiveChange={(v) => setEditForm((f) => ({ ...f, isActive: v }))}
                        onSubmit={(e) => void handleEdit(e)}
                        onCancel={() => setEditReason(null)}
                    />
                </Modal>
            )}
        </div>
    )
}

interface PointReasonFormProps {
    name: string
    pointType: PointType
    showIsActive: boolean
    isActive: boolean
    onNameChange: (v: string) => void
    onPointTypeChange: (v: PointType) => void
    onIsActiveChange: (v: boolean) => void
    onSubmit: (e: React.FormEvent) => void
    onCancel: () => void
}

function PointReasonForm({
    name,
    pointType,
    showIsActive,
    isActive,
    onNameChange,
    onPointTypeChange,
    onIsActiveChange,
    onSubmit,
    onCancel,
}: PointReasonFormProps) {
    const { t } = useTranslation()
    return (
        <form onSubmit={onSubmit}>
            <label htmlFor="pr-name" className="label">
                {t('common.name')}
            </label>
            <input
                id="pr-name"
                className="w-full bg-border border border-border rounded px-3 py-2 mb-4 text-white"
                value={name}
                onChange={(e) => onNameChange(e.target.value)}
                required
            />

            <fieldset className="mb-4">
                <legend className="text-sm text-text mb-2">{t('common.type')}</legend>
                <label className="flex items-center gap-2 mb-1 text-sm text-text cursor-pointer">
                    <input
                        type="radio"
                        name="pr-type"
                        checked={pointType === 'Negative'}
                        onChange={() => onPointTypeChange('Negative')}
                        className="accent-[var(--color-warning)]"
                    />
                    {t('common.negative')}
                </label>
                <label className="flex items-center gap-2 mb-1 text-sm text-text cursor-pointer">
                    <input
                        type="radio"
                        name="pr-type"
                        checked={pointType === 'Positive'}
                        onChange={() => onPointTypeChange('Positive')}
                        className="accent-[var(--color-primary)]"
                    />
                    {t('common.positive')}
                </label>
                <label className="flex items-center gap-2 text-sm text-text cursor-pointer">
                    <input
                        type="radio"
                        name="pr-type"
                        checked={pointType === 'Neutral'}
                        onChange={() => onPointTypeChange('Neutral')}
                        className="accent-[var(--color-text-muted)]"
                    />
                    {t('common.neutral')}
                </label>
            </fieldset>

            {showIsActive && (
                <label className="flex items-center gap-2 mb-4 text-sm text-text cursor-pointer">
                    <input
                        type="checkbox"
                        checked={isActive}
                        onChange={(e) => onIsActiveChange(e.target.checked)}
                        className="accent-[var(--color-primary)]"
                    />
                    {t('common.active')}
                </label>
            )}

            <div className="flex gap-2 justify-end">
                <button type="button" onClick={onCancel} className="btn-ghost text-sm">
                    {t('common.cancel')}
                </button>
                <button type="submit" className="px-4 py-2 text-sm bg-primary hover:bg-primary-hover rounded">
                    {t('common.save')}
                </button>
            </div>
        </form>
    )
}
