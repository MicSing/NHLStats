import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
    UserCircleIcon,
    ReceiptIcon,
    TrophyIcon,
    GearSixIcon,
} from '@phosphor-icons/react'
import { useAuth } from '../context/AuthContext'
import { cacheService } from '../services/cacheService'
import { bettingService } from '../services/bettingService'
import type { AchievementResult } from '../types/achievement'
import type { BettingBalanceDto } from '../types/bet'
import { AchievementModal } from '../components/stats/AchievementsTab'
import type { AchievementDef } from '../components/stats/achievementDefs'
import ProfileOverviewTab from '../components/profile/ProfileOverviewTab'
import ProfileBetsTab from '../components/profile/ProfileBetsTab'
import ProfileAchievementsTab from '../components/profile/ProfileAchievementsTab'
import ProfileSettingsTab from '../components/profile/ProfileSettingsTab'

type ProfileTab = 'overview' | 'bets' | 'achievements' | 'settings'

function isRecent(date: string | null, days = 7): boolean {
    if (!date) return false
    return new Date(date) >= new Date(Date.now() - days * 86_400_000)
}

export default function ProfilePage() {
    const { t } = useTranslation()
    const { user } = useAuth()
    const [searchParams, setSearchParams] = useSearchParams()

    const activeTab = (searchParams.get('tab') as ProfileTab) || 'overview'

    const setTab = (tab: ProfileTab) => {
        setSearchParams({ tab })
    }

    const [playerName, setPlayerName] = useState<string | null>(null)
    const [achievements, setAchievements] = useState<AchievementResult[]>([])
    const [balance, setBalance] = useState<BettingBalanceDto | null>(null)
    const [activeBetsCount, setActiveBetsCount] = useState<number>(0)
    const [selectedModal, setSelectedModal] = useState<{
        def: AchievementDef
        result: AchievementResult | undefined
    } | null>(null)

    // Load linked player name and achievements
    useEffect(() => {
        let isMounted = true

        // 1. Get linked player name
        if (user?.userId) {
            cacheService.getUsers().then((users) => {
                if (!isMounted) return
                const match = users.find((u) => u.id === user.userId)
                if (match) setPlayerName(match.name)
            }).catch(() => { /* silent */ })

            // 2. Get user achievements
            cacheService.getAchievements(user.userId).then((res) => {
                if (!isMounted) return
                setAchievements(res.achievements ?? [])
            }).catch(() => { /* silent */ })
        }

        // 3. Get betting balance and active bets
        bettingService.getBalance().then((b) => {
            if (isMounted) setBalance(b)
        }).catch(() => { /* silent */ })

        bettingService.listActive().then((activeList) => {
            if (isMounted) setActiveBetsCount(activeList.length)
        }).catch(() => { /* silent */ })

        return () => {
            isMounted = false
        }
    }, [user?.userId])

    // Check if user has new achievements in last 7 days
    const hasRecentAchievements = achievements.some((a) =>
        a.earned && a.occurrences.some((occ) => isRecent(occ.occurredOn))
    )

    const tabs = [
        {
            id: 'overview' as ProfileTab,
            label: t('profile.tabs.overview'),
            icon: UserCircleIcon,
            hasBadge: hasRecentAchievements,
        },
        {
            id: 'bets' as ProfileTab,
            label: t('profile.tabs.bets'),
            icon: ReceiptIcon,
        },
        {
            id: 'achievements' as ProfileTab,
            label: t('profile.tabs.achievements'),
            icon: TrophyIcon,
            hasBadge: hasRecentAchievements,
        },
        {
            id: 'settings' as ProfileTab,
            label: t('profile.tabs.settings'),
            icon: GearSixIcon,
        },
    ]

    return (
        <div className="container mx-auto px-3 sm:px-4 py-6 max-w-6xl space-y-6">
            {/* Page Header */}
            <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-text">
                    {t('profile.title')}
                </h1>
                <p className="text-xs sm:text-sm text-text-muted mt-1">
                    {t('profile.subtitle')}
                </p>
            </div>

            {/* Navigation Tabs Bar */}
            <div className="flex items-center gap-1 sm:gap-2 border-b border-border overflow-x-auto pb-px no-scrollbar">
                {tabs.map((tab) => {
                    const Icon = tab.icon
                    const isActive = activeTab === tab.id
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setTab(tab.id)}
                            className={`flex items-center gap-2 px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-medium border-b-2 transition-all whitespace-nowrap relative cursor-pointer ${
                                isActive
                                    ? 'border-primary text-primary font-semibold'
                                    : 'border-transparent text-text-muted hover:text-text hover:border-border'
                            }`}
                        >
                            <Icon size={18} />
                            <span>{tab.label}</span>
                            {tab.hasBadge && (
                                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                            )}
                        </button>
                    )
                })}
            </div>

            {/* Tab Contents */}
            <div>
                {activeTab === 'overview' && (
                    <ProfileOverviewTab
                        user={user}
                        playerName={playerName}
                        achievements={achievements}
                        balance={balance}
                        activeBetsCount={activeBetsCount}
                        onSelectTab={setTab}
                        onOpenAchievementModal={(def, result) =>
                            setSelectedModal({ def, result })
                        }
                    />
                )}

                {activeTab === 'bets' && <ProfileBetsTab />}

                {activeTab === 'achievements' && (
                    <ProfileAchievementsTab
                        achievements={achievements}
                        onOpenAchievementModal={(def, result) =>
                            setSelectedModal({ def, result })
                        }
                    />
                )}

                {activeTab === 'settings' && <ProfileSettingsTab />}
            </div>

            {/* Reusable Achievement Modal */}
            {selectedModal && (
                <AchievementModal
                    def={selectedModal.def}
                    result={selectedModal.result}
                    onClose={() => setSelectedModal(null)}
                />
            )}
        </div>
    )
}
