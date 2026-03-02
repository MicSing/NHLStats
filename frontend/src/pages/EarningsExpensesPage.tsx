import { useEffect, useState } from 'react'
import type { AllTimeEarnings } from '../types/stats'
import type { Expense } from '../types/expense'
import apiClient from '../services/apiClient'

function formatCurrency(value: number): string {
    const abs = Math.abs(value)
    const str = `€${abs.toFixed(2)}`
    return value < 0 ? `-${str}` : str
}

function formatDate(dateStr: string): string {
    return dateStr.split('T')[0]
}

export default function EarningsExpensesPage() {
    const [earnings, setEarnings] = useState<AllTimeEarnings | null>(null)
    const [expenses, setExpenses] = useState<Expense[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        Promise.all([
            apiClient.get<AllTimeEarnings>('/api/stats/earnings'),
            apiClient.get<Expense[]>('/api/expenses'),
        ])
            .then(([e, ex]) => {
                setEarnings(e)
                setExpenses(ex)
            })
            .catch(() => { })
            .finally(() => setLoading(false))
    }, [])

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
                <p className="text-gray-400">Loading…</p>
            </div>
        )
    }

    const users = earnings?.userEarnings ?? []
    const totalPlus = users.reduce((s, u) => s + u.totalPlus, 0)
    const totalMinus = users.reduce((s, u) => s + u.totalMinus, 0)
    const totalEarnings = users.reduce((s, u) => s + u.totalEarnings, 0)
    const expensesTotal = expenses.reduce((s, e) => s + e.amount, 0)

    return (
        <div className="min-h-screen bg-gray-900 text-white p-6">
            <div className="max-w-5xl mx-auto space-y-8">
                <h1 className="text-2xl font-bold text-cyan-400">Earnings &amp; Expenses</h1>

                {/* ── Earnings Table ──────────────────────────────────── */}
                <section>
                    <h2 className="text-lg font-semibold text-cyan-300 mb-3">Player Earnings</h2>
                    <div className="overflow-x-auto rounded-lg border border-gray-700">
                        <table
                            className="w-full text-sm"
                            aria-label="Earnings"
                            data-testid="earnings-table"
                        >
                            <thead className="bg-gray-800 text-gray-300 uppercase text-xs tracking-wider">
                                <tr>
                                    <th className="text-left px-4 py-3">Player</th>
                                    <th className="text-right px-4 py-3">+ Points</th>
                                    <th className="text-right px-4 py-3">− Points</th>
                                    <th className="text-right px-4 py-3">Earnings</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-700">
                                {users.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="text-center py-6 text-gray-500">
                                            No earnings data available.
                                        </td>
                                    </tr>
                                ) : (
                                    users.map((u) => (
                                        <tr key={u.userId} className="bg-gray-900 hover:bg-gray-800 transition-colors">
                                            <td className="px-4 py-3 font-medium">{u.userName}</td>
                                            <td className="px-4 py-3 text-right text-green-400">{u.totalPlus}</td>
                                            <td className="px-4 py-3 text-right text-red-400">{u.totalMinus}</td>
                                            <td
                                                className={`px-4 py-3 text-right font-medium ${u.totalEarnings >= 0 ? 'text-green-400' : 'text-red-400'
                                                    }`}
                                            >
                                                {formatCurrency(u.totalEarnings)}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                            {users.length > 0 && (
                                <tfoot className="bg-gray-800 border-t-2 border-gray-600 font-semibold text-sm">
                                    <tr>
                                        <td className="px-4 py-3 text-gray-200">Total</td>
                                        <td className="px-4 py-3 text-right text-green-300">{totalPlus}</td>
                                        <td className="px-4 py-3 text-right text-red-300">{totalMinus}</td>
                                        <td
                                            className={`px-4 py-3 text-right ${totalEarnings >= 0 ? 'text-green-300' : 'text-red-300'
                                                }`}
                                        >
                                            {formatCurrency(totalEarnings)}
                                        </td>
                                    </tr>
                                </tfoot>
                            )}
                        </table>
                    </div>
                </section>

                {/* ── Expenses Table ───────────────────────────────────── */}
                <section>
                    <h2 className="text-lg font-semibold text-cyan-300 mb-3">Group Expenses</h2>
                    <div className="overflow-x-auto rounded-lg border border-gray-700">
                        <table
                            className="w-full text-sm"
                            aria-label="Expenses"
                            data-testid="expenses-table"
                        >
                            <thead className="bg-gray-800 text-gray-300 uppercase text-xs tracking-wider">
                                <tr>
                                    <th className="text-left px-4 py-3">Description</th>
                                    <th className="text-right px-4 py-3">Amount</th>
                                    <th className="text-left px-4 py-3">Date</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-700">
                                {expenses.length === 0 ? (
                                    <tr>
                                        <td colSpan={3} className="text-center py-6 text-gray-500">
                                            No expenses recorded.
                                        </td>
                                    </tr>
                                ) : (
                                    expenses.map((e) => (
                                        <tr key={e.id} className="bg-gray-900 hover:bg-gray-800 transition-colors">
                                            <td className="px-4 py-3">{e.description ?? '—'}</td>
                                            <td className="px-4 py-3 text-right text-orange-400">
                                                {formatCurrency(e.amount)}
                                            </td>
                                            <td className="px-4 py-3 text-gray-400">{formatDate(e.date)}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                            {expenses.length > 0 && (
                                <tfoot className="bg-gray-800 border-t-2 border-gray-600 font-semibold text-sm">
                                    <tr>
                                        <td className="px-4 py-3 text-gray-200">Total</td>
                                        <td className="px-4 py-3 text-right text-orange-300">
                                            {formatCurrency(expensesTotal)}
                                        </td>
                                        <td />
                                    </tr>
                                </tfoot>
                            )}
                        </table>
                    </div>
                </section>

                {/* ── Balance Summary ───────────────────────────────────── */}
                {earnings && (
                    <section
                        className="bg-gray-800 rounded-lg border border-gray-700 p-6"
                        data-testid="balance-summary"
                    >
                        <h2 className="text-lg font-semibold text-cyan-300 mb-4">Balance Summary</h2>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div className="bg-gray-700 rounded-lg p-4 text-center">
                                <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">
                                    Total Collected
                                </p>
                                <p
                                    className={`text-2xl font-bold ${earnings.totalCollected >= 0 ? 'text-green-400' : 'text-red-400'
                                        }`}
                                >
                                    {formatCurrency(earnings.totalCollected)}
                                </p>
                            </div>
                            <div className="bg-gray-700 rounded-lg p-4 text-center">
                                <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">
                                    Total Expenses
                                </p>
                                <p className="text-2xl font-bold text-orange-400">
                                    {formatCurrency(earnings.totalExpenses)}
                                </p>
                            </div>
                            <div className="bg-gray-700 rounded-lg p-4 text-center">
                                <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Remaining</p>
                                <p
                                    className={`text-2xl font-bold ${earnings.balance >= 0 ? 'text-green-400' : 'text-red-400'
                                        }`}
                                >
                                    {formatCurrency(earnings.balance)}
                                </p>
                            </div>
                        </div>
                    </section>
                )}
            </div>
        </div>
    )
}
