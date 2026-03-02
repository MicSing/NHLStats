import { useEffect, useState } from 'react'
import type { Expense, CreateExpenseDto, UpdateExpenseDto } from '../../types/expense'
import apiClient from '../../services/apiClient'
import Modal from '../../components/Modal'

export default function ExpensesPage() {
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
            setError('Failed to load expenses')
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
        if (!window.confirm('Delete this expense?')) return
        await apiClient.delete(`/api/expenses/${id}`)
        await loadExpenses()
    }

    const total = expenses.reduce((sum, e) => sum + e.amount, 0)

    if (loading) return <p>Loading…</p>
    if (error) return <p role="alert">{error}</p>

    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold text-cyan-400">Expenses</h1>
                <button
                    onClick={() => setShowAddModal(true)}
                    className="bg-cyan-600 hover:bg-cyan-700 px-4 py-2 rounded text-sm font-medium"
                >
                    Add Expense
                </button>
            </div>

            <table className="w-full text-sm">
                <thead>
                    <tr className="text-left border-b border-gray-700 text-gray-400">
                        <th className="pb-2 pr-4">Description</th>
                        <th className="pb-2 pr-4">Amount</th>
                        <th className="pb-2 pr-4">Date</th>
                        <th className="pb-2">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {expenses.map((expense) => (
                        <tr key={expense.id} className="border-b border-gray-700/50">
                            <td className="py-3 pr-4">{expense.description ?? '—'}</td>
                            <td className="py-3 pr-4 text-cyan-300">
                                {expense.amount.toFixed(2)} €
                            </td>
                            <td className="py-3 pr-4 text-gray-300">
                                {new Date(expense.date).toLocaleDateString()}
                            </td>
                            <td className="py-3 flex gap-2">
                                <button
                                    onClick={() => openEdit(expense)}
                                    className="text-xs bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded"
                                >
                                    Edit
                                </button>
                                <button
                                    onClick={() => void handleDelete(expense.id)}
                                    className="text-xs bg-red-900 hover:bg-red-800 px-3 py-1 rounded"
                                >
                                    Delete
                                </button>
                            </td>
                        </tr>
                    ))}
                    {expenses.length > 0 && (
                        <tr className="border-t border-gray-600 font-semibold">
                            <td className="pt-3 pr-4 text-gray-300">Total</td>
                            <td className="pt-3 pr-4 text-cyan-300">{total.toFixed(2)} €</td>
                            <td colSpan={2} />
                        </tr>
                    )}
                </tbody>
            </table>

            {expenses.length === 0 && (
                <p className="text-gray-400 text-sm mt-4">No expenses recorded yet.</p>
            )}

            {/* Add modal */}
            {showAddModal && (
                <Modal title="Add Expense" onClose={() => setShowAddModal(false)}>
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
                <Modal title="Edit Expense" onClose={() => setEditExpense(null)}>
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
    const set = (patch: Partial<CreateExpenseDto>) => onChange({ ...form, ...patch })

    return (
        <form onSubmit={onSubmit}>
            <label htmlFor="expense-description" className="block text-sm mb-1 text-gray-300">
                Description
            </label>
            <input
                id="expense-description"
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 mb-3 text-white"
                value={form.description ?? ''}
                onChange={(e) => set({ description: e.target.value || null })}
                placeholder="Optional"
            />

            <label htmlFor="expense-amount" className="block text-sm mb-1 text-gray-300">
                Amount (€)
            </label>
            <input
                id="expense-amount"
                type="number"
                step="0.01"
                min="0"
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 mb-3 text-white"
                value={form.amount}
                onChange={(e) => set({ amount: parseFloat(e.target.value) || 0 })}
                required
            />

            <label htmlFor="expense-date" className="block text-sm mb-1 text-gray-300">
                Date
            </label>
            <input
                id="expense-date"
                type="date"
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 mb-4 text-white"
                value={form.date}
                onChange={(e) => set({ date: e.target.value })}
                required
            />

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
