import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import PageLayout from '../components/PageLayout'
import ArchiveTab from '../components/betting/ArchiveTab'
import BettingTab from '../components/betting/BettingTab'
import TicketsTab from '../components/betting/TicketsTab'
import { useAuth } from '../context/AuthContext'
import type { BettingBalanceDto } from '../types/bet'

type Tab = 'betting' | 'archive' | 'tickets'

export default function BettingPage() {
    const { t } = useTranslation()
    const { user } = useAuth()
    const [searchParams, setSearchParams] = useSearchParams()

    const userId = user?.userId ?? null

    const rawTab = searchParams.get('tab')
    const tab: Tab = rawTab === 'archive' || rawTab === 'tickets' ? rawTab : 'betting'

    const [balance, setBalance] = useState<BettingBalanceDto | null>(null)

    const setTab = (next: Tab) => {
        setSearchParams(prev => {
            const p = new URLSearchParams(prev)
            p.set('tab', next)
            // clear ticket filter params when leaving tickets tab
            if (next !== 'tickets') {
                ['id','userId','matchNumber','seasonId','status','structure','betType',
                 'stakeMin','stakeMax','oddsMin','oddsMax','winMin','winMax',
                 'sortBy','sortDir','page'].forEach(k => p.delete(k))
            }
            return p
        })
    }

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
                        <button
                            onClick={() => setTab('tickets')}
                            className={`px-4 py-1.5 text-sm font-semibold rounded transition-colors ${
                                tab === 'tickets' ? 'bg-primary text-white' : 'text-text-muted hover:text-text'
                            }`}
                        >
                            {t('betting.tabTickets', 'Tickets')}
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
                ) : tab === 'archive' ? (
                    <ArchiveTab />
                ) : (
                    <TicketsTab />
                )}
            </div>
        </PageLayout>
    )
}
