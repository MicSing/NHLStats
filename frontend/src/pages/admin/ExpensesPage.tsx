import { useEffect, useState } from 'react'
import type { Expense, CreateExpenseDto, UpdateExpenseDto } from '../../types/expense'
import apiClient from '../../services/apiClient'
import Modal from '../../components/Modal'
import { useTranslation } from 'react-i18next'

export default function ExpensesPage() {
    const { t } = useTranslation()
    const [expenses, setExpenses] = useState<Expense[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    // Add modal
    const [showAddModal, setShowAddModal] = useState(false)
    const [addForm, setAddForm] = useState<CreateExpenseDto>({
        description: '',
        amount: 0,
        date: new Date().toISOString().split('T')[0],
    })

    // Edit modal
    const [editExpense, setEditExpense] = useState<Expense | null>(null)
    const [editForm, setEditForm] = useState<UpdateExpenseDto>({
        description: '',
        amount: 0,
        date: '',
    })

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
        await apiClient.post<Expense>('/api/expenses', addForm)
        setShowAddModal(false)
        setAddForm({
            description: '',
            amount: 0,
            date: new Date().toISOString().split('T')[0],
        })
        await loadExpenses()
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
        await apiClient.put<Expense>(`/api/expenses/${editExpense.id}`, editForm)
        setEditExpense(null)
        await loadExpenses()
    }

    const handleDelete = async (id: number) => {
        if (!window.confirm(t('admin.expenses.deleteConfirm'))) return
        await apiClient.delete(`/api/expenses/${id}`)
        await loadExpenses()
    }

    const total = expenses.reduce((sum, e) => sum + e.amount, 0)

    if (loading) return <p>{t('common.loading')}</p>
    if (error) return <p role="alert">{error}</p>

    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold text-primary">{t('admin.expenses.title')}</h1>
                <button
                    onClick={() => setShowAddModal(true)}
                    className="bg-primary hover:bg-primary-hover px-4 py-2 rounded text-sm font-medium"
                >
                    {t('admin.expenses.addExpense')}
                </button>
            </div>

            <table className="w-full text-sm">
                <thead>
                    <tr className="text-left border-b border-border text-text-muted">
                        <th className="pb-2 pr-4">{t('common.description')}</th>
                        <th className="pb-2 pr-4">{t('common.amount')}</th>
                        <th className="pb-2 pr-4">{t('common.date')}</th>
                        <th className="pb-2">{t('common.actions')}</th>
                    </tr>
                </thead>
                <tbody>
                    {expenses.map((expense) => (
                        <tr key={expense.id} className="border-b border-border/50">
                            <td className="py-3 pr-4">{expense.description ?? '—'}</td>
                            <td className="py-3 pr-4 text-primary/80">
                                {expense.amount.toFixed(2)} €
                            </td>
                            <td className="py-3 pr-4 text-text">
                                {new Date(expense.date).toLocaleDateString()}
                            </td>
                            <td className="py-3 flex gap-2">
                                <button
                                    onClick={() => openEdit(expense)}
                                    className="text-xs bg-border hover:bg-border/80 px-3 py-1 rounded"
                                >
                                    {t('common.edit')}
                                </button>
                                <button
                                    onClick={() => void handleDelete(expense.id)}
                                    className="text-xs bg-red-900 hover:bg-red-800 px-3 py-1 rounded"
                                >
                                    {t('common.delete')}
                                </button>
                            </td>
                        </tr>
                    ))}
                    {expenses.length > 0 && (
                        <tr className="border-t border-border font-semibold">
                            <td className="pt-3 pr-4 text-text">{t('common.total')}</td>
                            <td className="pt-3 pr-4 text-primary/80">{total.toFixed(2)} €</td>
                            <td colSpan={2} />
                        </tr>
                    )}
                </tbody>
            </table>

            {expenses.length === 0 && (
                <p className="text-text-muted text-sm mt-4">{t('admin.expenses.noExpenses')}</p>
            )}

            {/* Add modal */}
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

            {/* Edit modal */}
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

// ---- Extracted form ----

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
