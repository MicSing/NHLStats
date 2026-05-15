import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Gear, Receipt, CurrencyDollar } from '@phosphor-icons/react'
import MoneyConfigTab from '../../components/finance/MoneyConfigTab'
import ExpensesTab from '../../components/finance/ExpensesTab'
import CollectingTab from '../../components/finance/CollectingTab'
import AdminPageHeader from '../../components/AdminPageHeader'

type Tab = 'rates' | 'expenses' | 'collecting'

const tabs: { key: Tab; labelKey: string; Icon: React.ElementType }[] = [
    { key: 'rates', labelKey: 'admin.finance.tabRates', Icon: Gear },
    { key: 'expenses', labelKey: 'admin.finance.tabExpenses', Icon: Receipt },
    { key: 'collecting', labelKey: 'admin.finance.tabCollecting', Icon: CurrencyDollar },
]

const addLabelKeys: Record<Tab, string> = {
    rates: 'admin.finance.addConfig',
    expenses: 'admin.finance.addExpense',
    collecting: 'admin.finance.addCollection',
}

export default function FinancePage() {
    const { t } = useTranslation()
    const [activeTab, setActiveTab] = useState<Tab>('rates')
    const [addOpen, setAddOpen] = useState(false)

    return (
        <div>
            <AdminPageHeader
                title={t('nav.finance')}
                action={{ label: t(addLabelKeys[activeTab]), onClick: () => setAddOpen(true) }}
            />

            <div className="flex border-b border-border mb-6">
                {tabs.map(({ key, labelKey, Icon }) => (
                    <button
                        key={key}
                        onClick={() => setActiveTab(key)}
                        className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                            activeTab === key
                                ? 'border-primary text-primary'
                                : 'border-transparent text-text-muted hover:text-text'
                        }`}
                    >
                        <Icon size={16} />
                        {t(labelKey)}
                    </button>
                ))}
            </div>

            {activeTab === 'rates' && (
                <MoneyConfigTab addOpen={addOpen} onAddClose={() => setAddOpen(false)} />
            )}
            {activeTab === 'expenses' && (
                <ExpensesTab addOpen={addOpen} onAddClose={() => setAddOpen(false)} />
            )}
            {activeTab === 'collecting' && (
                <CollectingTab addOpen={addOpen} onAddClose={() => setAddOpen(false)} />
            )}
        </div>
    )
}
