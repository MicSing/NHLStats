import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import PageLayout from '../components/PageLayout'
import ArchiveTab from '../components/betting/ArchiveTab'
import BettingTab from '../components/betting/BettingTab'
import { useAuth } from '../context/AuthContext'
import type { BettingBalanceDto } from '../types/bet'

type Tab = 'betting' | 'archive'

export default function BettingPage() {
    const { t } = useTranslation()
    const { user } = useAuth()

    const userId = user?.userId ?? null

    const [tab, setTab] = useState<Tab>('betting')
    const [balance, setBalance] = useState<BettingBalanceDto | null>(null)

    if (!userId) {
        return (
            <PageLayout>
                <p>{t('betting.loginRequired')}</p>
            </PageLayout>
        )
    }

    return (
        <PageLayout>
            <div className="space-y-6">
                {/* Header: tabs + balance cards */}
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-3">
                    <div className="flex gap-1 rounded-lg bg-surface p-1 border border-border">
                        <button
                            onClick={() => setTab('betting')}
                            className={`px-4 py-1.5 text-sm font-semibold rounded transition-colors ${
                                tab === 'betting' ? 'bg-primary text-white' : 'text-text-muted hover:text-text'
                            }`}
                        >
                            {t('betting.tabBetting')}
                        </button>
                        <button
                            onClick={() => setTab('archive')}
                            className={`px-4 py-1.5 text-sm font-semibold rounded transition-colors ${
                                tab === 'archive' ? 'bg-primary text-white' : 'text-text-muted hover:text-text'
                            }`}
                        >
                            {t('betting.tabArchive')}
                        </button>
                    </div>
                    {balance && (
                        <div className="flex gap-3 text-sm">
                            <div className="card px-4 py-2 text-center">
                                <p className="text-text-muted text-xs mb-0.5">{t('betting.availableBalance')}</p>
                                <p className="font-bold text-success text-lg">{balance.availableBalance.toFixed(2)} €</p>
                            </div>
                            {balance.maxWinCap > 0 && (
                                <div className="card px-4 py-2 text-center">
                                    <p className="text-text-muted text-xs mb-0.5">{t('betting.maxWinCap')}</p>
                                    <p className="font-bold text-warning text-lg">{balance.maxWinCap.toFixed(2)} €</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {tab === 'betting' ? (
                    <BettingTab userId={userId} onBalanceChanged={setBalance} />
                ) : (
                    <ArchiveTab />
                )}
            </div>
        </PageLayout>
    )
}
