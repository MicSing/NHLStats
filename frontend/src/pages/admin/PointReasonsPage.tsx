import { useEffect, useState } from 'react'
import type { PointReason, CreatePointReasonDto, UpdatePointReasonDto } from '../../types/pointReason'
import apiClient from '../../services/apiClient'
import Modal from '../../components/Modal'

export default function PointReasonsPage() {
    const [reasons, setReasons] = useState<PointReason[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    // Add modal
    const [showAddModal, setShowAddModal] = useState(false)
    const [addForm, setAddForm] = useState<CreatePointReasonDto>({ name: '', isPositive: false })

    // Edit modal
    const [editReason, setEditReason] = useState<PointReason | null>(null)
    const [editForm, setEditForm] = useState<UpdatePointReasonDto>({
        name: '',
        isPositive: false,
        isActive: true,
    })

    const loadReasons = async () => {
        try {
            const data = await apiClient.get<PointReason[]>('/api/pointreasons')
            setReasons(data)
        } catch {
            setError('Failed to load point reasons')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        void loadReasons()
    }, [])

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault()
        await apiClient.post<PointReason>('/api/pointreasons', addForm)
        setShowAddModal(false)
        setAddForm({ name: '', isPositive: false })
        await loadReasons()
    }

    const openEdit = (reason: PointReason) => {
        setEditReason(reason)
        setEditForm({ name: reason.name, isPositive: reason.isPositive, isActive: reason.isActive })
    }

    const handleEdit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!editReason) return
        await apiClient.put<PointReason>(`/api/pointreasons/${editReason.id}`, editForm)
        setEditReason(null)
        await loadReasons()
    }

    const handleDeactivate = async (reason: PointReason) => {
        await apiClient.put<PointReason>(`/api/pointreasons/${reason.id}`, {
            name: reason.name,
            isPositive: reason.isPositive,
            isActive: false,
        } satisfies UpdatePointReasonDto)
        await loadReasons()
    }

    if (loading) return <p>Loading…</p>
    if (error) return <p role="alert">{error}</p>

    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold text-cyan-400">Point Reasons</h1>
                <button
                    onClick={() => setShowAddModal(true)}
                    className="bg-cyan-600 hover:bg-cyan-700 px-4 py-2 rounded text-sm font-medium"
                >
                    Add Reason
                </button>
            </div>

            <table className="w-full text-sm">
                <thead>
                    <tr className="text-left border-b border-gray-700 text-gray-400">
                        <th className="pb-2 pr-4">Name</th>
                        <th className="pb-2 pr-4">Type</th>
                        <th className="pb-2 pr-4">Status</th>
                        <th className="pb-2">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {reasons.map((reason) => (
                        <tr key={reason.id} className="border-b border-gray-700/50">
                            <td className="py-3 pr-4">{reason.name}</td>
                            <td className="py-3 pr-4">
                                <span
                                    className={`text-xs px-2 py-1 rounded-full ${reason.isPositive
                                            ? 'bg-cyan-900 text-cyan-300'
                                            : 'bg-orange-900 text-orange-300'
                                        }`}
                                >
                                    {reason.isPositive ? 'Positive' : 'Negative'}
                                </span>
                            </td>
                            <td className="py-3 pr-4">
                                <span
                                    className={`text-xs px-2 py-1 rounded-full ${reason.isActive
                                            ? 'bg-green-800 text-green-200'
                                            : 'bg-gray-700 text-gray-400'
                                        }`}
                                >
                                    {reason.isActive ? 'Active' : 'Inactive'}
                                </span>
                            </td>
                            <td className="py-3 flex gap-2">
                                <button
                                    onClick={() => openEdit(reason)}
                                    className="text-xs bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded"
                                >
                                    Edit
                                </button>
                                {reason.isActive && (
                                    <button
                                        onClick={() => void handleDeactivate(reason)}
                                        className="text-xs bg-orange-800 hover:bg-orange-700 px-3 py-1 rounded"
                                    >
                                        Deactivate
                                    </button>
                                )}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>

            {/* Add modal */}
            {showAddModal && (
                <Modal title="Add Point Reason" onClose={() => setShowAddModal(false)}>
                    <PointReasonForm
                        name={addForm.name}
                        isPositive={addForm.isPositive}
                        showIsActive={false}
                        isActive={true}
                        onNameChange={(v) => setAddForm((f) => ({ ...f, name: v }))}
                        onIsPositiveChange={(v) => setAddForm((f) => ({ ...f, isPositive: v }))}
                        onIsActiveChange={() => { }}
                        onSubmit={(e) => void handleAdd(e)}
                        onCancel={() => setShowAddModal(false)}
                    />
                </Modal>
            )}

            {/* Edit modal */}
            {editReason && (
                <Modal title="Edit Point Reason" onClose={() => setEditReason(null)}>
                    <PointReasonForm
                        name={editForm.name}
                        isPositive={editForm.isPositive}
                        showIsActive={true}
                        isActive={editForm.isActive}
                        onNameChange={(v) => setEditForm((f) => ({ ...f, name: v }))}
                        onIsPositiveChange={(v) => setEditForm((f) => ({ ...f, isPositive: v }))}
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
    isPositive: boolean
    showIsActive: boolean
    isActive: boolean
    onNameChange: (v: string) => void
    onIsPositiveChange: (v: boolean) => void
    onIsActiveChange: (v: boolean) => void
    onSubmit: (e: React.FormEvent) => void
    onCancel: () => void
}

function PointReasonForm({
    name,
    isPositive,
    showIsActive,
    isActive,
    onNameChange,
    onIsPositiveChange,
    onIsActiveChange,
    onSubmit,
    onCancel,
}: PointReasonFormProps) {
    return (
        <form onSubmit={onSubmit}>
            <label htmlFor="pr-name" className="block text-sm mb-1 text-gray-300">
                Name
            </label>
            <input
                id="pr-name"
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 mb-4 text-white"
                value={name}
                onChange={(e) => onNameChange(e.target.value)}
                required
            />

            <fieldset className="mb-4">
                <legend className="text-sm text-gray-300 mb-2">Type</legend>
                <label className="flex items-center gap-2 mb-1 text-sm text-gray-300 cursor-pointer">
                    <input
                        type="radio"
                        name="pr-type"
                        checked={!isPositive}
                        onChange={() => onIsPositiveChange(false)}
                        className="accent-orange-400"
                    />
                    Negative
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                    <input
                        type="radio"
                        name="pr-type"
                        checked={isPositive}
                        onChange={() => onIsPositiveChange(true)}
                        className="accent-cyan-400"
                    />
                    Positive
                </label>
            </fieldset>

            {showIsActive && (
                <label className="flex items-center gap-2 mb-4 text-sm text-gray-300 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={isActive}
                        onChange={(e) => onIsActiveChange(e.target.checked)}
                        className="accent-cyan-500"
                    />
                    Active
                </label>
            )}

            <div className="flex gap-2 justify-end">
                <button type="button" onClick={onCancel} className="px-4 py-2 text-sm bg-gray-700 rounded">
                    Cancel
                </button>
                <button type="submit" className="px-4 py-2 text-sm bg-cyan-600 hover:bg-cyan-700 rounded">
                    Save
                </button>
            </div>
        </form>
    )
}
