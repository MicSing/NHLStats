import { useEffect, useState } from 'react'
import type { PointReason, PointType, CreatePointReasonDto, UpdatePointReasonDto } from '../../types/pointReason'
import apiClient from '../../services/apiClient'
import Modal from '../../components/Modal'
import { useTranslation } from 'react-i18next'
import LoadingSpinner from '../../components/LoadingSpinner'
import ErrorMessage from '../../components/ErrorMessage'
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

    // Add modal
    const [showAddModal, setShowAddModal] = useState(false)
    const [addForm, setAddForm] = useState<CreatePointReasonDto>({ name: '', pointType: 'Negative' })

    // Edit modal
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

    if (loading) return <LoadingSpinner />
    if (error) return <ErrorMessage message={error} onRetry={() => void loadReasons()} />

    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold text-primary">{t('admin.pointReasons.title')}</h1>
                <button
                    onClick={() => setShowAddModal(true)}
                    className="bg-primary hover:bg-primary-hover px-4 py-2 rounded text-sm font-medium"
                >
                    {t('admin.pointReasons.addReason')}
                </button>
            </div>

            <div className="mb-4">
                <SearchInput value={search} onChange={setSearch} placeholder={t('common.search')} />
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="text-left border-b border-border text-text-muted">
                            <th className="pb-2 pr-4">{t('common.name')}</th>
                            <th className="pb-2 pr-4">{t('common.type')}</th>
                            <th className="pb-2 pr-4">{t('common.status')}</th>
                            <th className="pb-2">{t('common.actions')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {pageItems.map((reason) => (
                            <tr key={reason.id} className="border-b border-border/50">
                                <td className="py-3 pr-4">{reason.name}</td>
                                <td className="py-3 pr-4">
                                    <span
                                        className={`text-xs px-2 py-1 rounded-full ${reason.pointType === 'Positive'
                                                ? 'bg-primary/20 text-primary'
                                                : reason.pointType === 'Negative'
                                                    ? 'bg-warning/20 text-warning'
                                                    : 'bg-border text-text-muted'
                                            }`}
                                    >
                                        {reason.pointType === 'Positive'
                                            ? t('common.positive')
                                            : reason.pointType === 'Negative'
                                                ? t('common.negative')
                                                : t('common.neutral')}
                                    </span>
                                </td>
                                <td className="py-3 pr-4">
                                    <span
                                        className={`text-xs px-2 py-1 rounded-full ${reason.isActive
                                            ? 'bg-success/20 text-success'
                                            : 'bg-border text-text-muted'
                                            }`}
                                    >
                                        {reason.isActive ? t('common.active') : t('common.inactive')}
                                    </span>
                                </td>
                                <td className="py-3 flex gap-2">
                                    <button
                                        onClick={() => openEdit(reason)}
                                        className="text-xs bg-border hover:bg-border/80 px-3 py-1 rounded"
                                    >
                                        {t('common.edit')}
                                    </button>
                                    {reason.isActive && (
                                        <button
                                            onClick={() => void handleDeactivate(reason)}
                                            className="text-xs bg-warning/20 hover:bg-warning/30 text-warning px-3 py-1 rounded"
                                        >
                                            {t('common.deactivate')}
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <Pagination
                currentPage={currentPage}
                totalItems={totalFiltered}
                pageSize={20}
                onPageChange={setCurrentPage}
            />

            {/* Add modal */}
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

            {/* Edit modal */}
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

// ---- Extracted form ----

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
