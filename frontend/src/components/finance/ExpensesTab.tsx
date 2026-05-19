import { useEffect, useState } from 'react'
import type { Expense, CreateExpenseDto, UpdateExpenseDto } from '../../types/expense'
import apiClient from '../../services/apiClient'
import Modal from '../Modal'
import { useTranslation } from 'react-i18next'
import LoadingSpinner from '../LoadingSpinner'
import ErrorMessage from '../ErrorMessage'
import SearchInput from '../SearchInput'
import Pagination from '../Pagination'
import useTable from '../../hooks/useTable'
import { useToast } from '../../context/ToastContext'
import { PencilIcon, TrashIcon } from '@phosphor-icons/react'

interface Props {
    addOpen?: boolean
    onAddClose?: () => void
}

export default function ExpensesTab({ addOpen, onAddClose }: Props) {
    const { t } = useTranslation()
    const toast = useToast()
    const [expenses, setExpenses] = useState<Expense[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const [showAddModal, setShowAddModal] = useState(false)
    const [addForm, setAddForm] = useState<CreateExpenseDto>({
        description: '',
        amount: 0,
        date: new Date().toISOString().split('T')[0],
    })

    const [editExpense, setEditExpense] = useState<Expense | null>(null)
    const [editForm, setEditForm] = useState<UpdateExpenseDto>({
        description: '',
        amount: 0,
        date: '',
    })

    const { pageItems, totalFiltered, search, setSearch, currentPage, setCurrentPage } = useTable({
        data: expenses,
        searchFields: (e) => [e.description ?? ''],
    })

    useEffect(() => {
        if (addOpen) {
            setShowAddModal(true)
            onAddClose?.()
        }
    }, [addOpen])

    const loadExpenses = async () => {
        try {
            const data = await apiClient.get<Expense[]>('/api/expenses')
            setExpenses(data)
        } catch {
            setError(t('errors.failedToLoadExpenses'))
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        void loadExpenses()
    }, [])

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault()
        try {
            await apiClient.post<Expense>('/api/expenses', addForm)
            setShowAddModal(false)
            setAddForm({
                description: '',
                amount: 0,
                date: new Date().toISOString().split('T')[0],
            })
            toast.success(t('toast.createSuccess'))
            await loadExpenses()
        } catch {
            toast.error(t('toast.operationFailed'))
        }
    }

    const openEdit = (expense: Expense) => {
        setEditExpense(expense)
        setEditForm({
            description: expense.description ?? '',
            amount: expense.amount,
            date: expense.date.split('T')[0],
        })
    }

    const handleEdit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!editExpense) return
        try {
            await apiClient.put<Expense>(`/api/expenses/${editExpense.id}`, editForm)
            setEditExpense(null)
            toast.success(t('toast.saveSuccess'))
            await loadExpenses()
        } catch {
            toast.error(t('toast.operationFailed'))
        }
    }

    const handleDelete = async (id: number) => {
        if (!window.confirm(t('admin.expenses.deleteConfirm'))) return
        try {
            await apiClient.delete(`/api/expenses/${id}`)
            toast.success(t('toast.deleteSuccess'))
            await loadExpenses()
        } catch {
            toast.error(t('toast.operationFailed'))
        }
    }

    const total = expenses.reduce((sum, e) => sum + e.amount, 0)

    if (loading) return <LoadingSpinner />
    if (error) return <ErrorMessage message={error} onRetry={() => void loadExpenses()} />

    return (
        <div>
            <div className="mb-4">
                <SearchInput value={search} onChange={setSearch} placeholder={t('common.search')} />
            </div>

            <div className="overflow-x-auto rounded-xl border border-border overflow-hidden">
                <table className="w-full text-sm">
                    <thead className="bg-surface">
                        <tr className="text-left text-text-muted uppercase text-xs tracking-wider">
                            <th className="px-4 py-3 font-medium w-1/2">{t('common.description')}</th>
                            <th className="px-4 py-3 font-medium">{t('common.amount')}</th>
                            <th className="px-4 py-3 font-medium">{t('common.date')}</th>
                            <th className="px-4 py-3" />
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {pageItems.map((expense) => (
                            <tr key={expense.id} className="hover:bg-surface/50 transition-colors group">
                                <td className="px-4 py-3">{expense.description ?? '—'}</td>
                                <td className="px-4 py-3 text-primary/80 font-mono">
                                    {expense.amount.toFixed(2)} €
                                </td>
                                <td className="px-4 py-3 text-text-muted">
                                    {new Date(expense.date).toLocaleDateString()}
                                </td>
                                <td className="px-4 py-3">
                                    <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={() => openEdit(expense)}
                                            className="p-1.5 text-text-muted hover:text-primary hover:bg-primary/10 rounded transition-colors"
                                            title={t('common.edit')}
                                        >
                                            <PencilIcon size={16} />
                                        </button>
                                        <button
                                            onClick={() => void handleDelete(expense.id)}
                                            className="p-1.5 text-text-muted hover:text-danger hover:bg-danger/10 rounded transition-colors"
                                            title={t('common.delete')}
                                        >
                                            <TrashIcon size={16} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {expenses.length > 0 && (
                            <tr className="bg-surface border-t-2 border-border font-semibold">
                                <td className="px-4 py-3 text-text-muted uppercase text-xs tracking-wider">{t('common.total')}</td>
                                <td className="px-4 py-3 text-primary/80 font-mono">{total.toFixed(2)} €</td>
                                <td colSpan={2} />
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            <Pagination
                currentPage={currentPage}
                totalItems={totalFiltered}
                pageSize={20}
                onPageChange={setCurrentPage}
            />

            {expenses.length === 0 && (
                <p className="text-text-muted text-sm mt-4">{t('admin.expenses.noExpenses')}</p>
            )}

            {showAddModal && (
                <Modal title={t('admin.expenses.addExpense')} onClose={() => setShowAddModal(false)}>
                    <ExpenseForm
                        form={addForm}
                        onChange={setAddForm}
                        onSubmit={(e) => void handleAdd(e)}
                        onCancel={() => setShowAddModal(false)}
                    />
                </Modal>
            )}

            {editExpense && (
                <Modal title={t('admin.expenses.editExpense')} onClose={() => setEditExpense(null)}>
                    <ExpenseForm
                        form={editForm}
                        onChange={setEditForm}
                        onSubmit={(e) => void handleEdit(e)}
                        onCancel={() => setEditExpense(null)}
                    />
                </Modal>
            )}
        </div>
    )
}

interface ExpenseFormProps {
    form: CreateExpenseDto
    onChange: (f: CreateExpenseDto) => void
    onSubmit: (e: React.FormEvent) => void
    onCancel: () => void
}

function ExpenseForm({ form, onChange, onSubmit, onCancel }: ExpenseFormProps) {
    const { t } = useTranslation()
    const set = (patch: Partial<CreateExpenseDto>) => onChange({ ...form, ...patch })

    return (
        <form onSubmit={onSubmit}>
            <label htmlFor="expense-description" className="label">
                {t('admin.expenses.descriptionLabel')}
            </label>
            <input
                id="expense-description"
                className="w-full bg-border border border-border rounded px-3 py-2 mb-3 text-white"
                value={form.description ?? ''}
                onChange={(e) => set({ description: e.target.value || null })}
                placeholder={t('common.optional')}
            />

            <label htmlFor="expense-amount" className="label">
                {t('admin.expenses.amountLabel')}
            </label>
            <input
                id="expense-amount"
                type="number"
                step="0.01"
                min="0"
                className="w-full bg-border border border-border rounded px-3 py-2 mb-3 text-white"
                value={form.amount}
                onChange={(e) => set({ amount: parseFloat(e.target.value) || 0 })}
                required
            />

            <label htmlFor="expense-date" className="label">
                {t('admin.expenses.dateLabel')}
            </label>
            <input
                id="expense-date"
                type="date"
                className="w-full bg-border border border-border rounded px-3 py-2 mb-4 text-white"
                value={form.date}
                onChange={(e) => set({ date: e.target.value })}
                required
            />

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
