import { useTranslation } from 'react-i18next'
import { LockSimpleIcon } from '@phosphor-icons/react'
import type { AchievementResult } from '../../types/achievement'
import type { AchievementDef } from '../stats/achievementDefs'
import { useAchievementFilters, isRecent } from '../stats/useAchievementFilters'
import AchievementFilterBar from '../stats/AchievementFilterBar'

interface ProfileAchievementsTabProps {
    achievements: AchievementResult[]
    onOpenAchievementModal: (def: AchievementDef, result: AchievementResult) => void
}

export default function ProfileAchievementsTab({
    achievements,
    onOpenAchievementModal,
}: ProfileAchievementsTabProps) {
    const { t } = useTranslation()
    const filters = useAchievementFilters(achievements)
    const { achievementMap, filteredDefs, activeFilters, clearAllFilters } = filters

    return (
        <div className="space-y-6">
            <AchievementFilterBar {...filters} />

            {/* Achievement Grid */}
            {filteredDefs.length === 0 ? (
                <div className="card p-8 text-center">
                    <p className="text-text-muted text-sm">{t('profile.achievements.noMatches')}</p>
                    {activeFilters.length > 0 && (
                        <button
                            type="button"
                            onClick={clearAllFilters}
                            className="mt-3 text-xs text-primary hover:underline font-medium"
                        >
                            {t('profile.achievements.clearAll')}
                        </button>
                    )}
                </div>
            ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                    {filteredDefs.map((def) => {
                        const result = achievementMap.get(def.id)
                        const level = result?.level ?? 0
                        const earned = level > 0
                        const idx = Math.max(0, level - 1)
                        const icon = !earned && def.disabledIcon ? def.disabledIcon : def.levelIcons[idx]
                        const name = def.levelNames[idx]
                        const hasRecent = result?.occurrences.some((occ) => isRecent(occ.occurredOn)) ?? false

                        return (
                            <button
                                key={def.id}
                                onClick={() => {
                                    if (result) onOpenAchievementModal(def, result)
                                    else {
                                        // Empty result placeholder for locked badges
                                        onOpenAchievementModal(def, {
                                            id: def.id,
                                            earned: false,
                                            level: 0,
                                            count: 0,
                                            currentLevelAt: 0,
                                            nextLevelAt: 1,
                                            occurrences: [],
                                        })
                                    }
                                }}
                                className={[
                                    'rounded-xl p-3 border flex flex-col items-center gap-2 text-center relative w-full transition-all duration-200 cursor-pointer',
                                    earned
                                        ? 'bg-surface border-border hover:border-primary/60 hover:scale-[1.02] shadow-sm'
                                        : 'bg-surface/50 border-border/60 opacity-40 grayscale hover:opacity-60',
                                    hasRecent
                                        ? 'ring-2 ring-amber-400/80 shadow-amber-400/20 shadow-md !opacity-100 !grayscale-0'
                                        : '',
                                ].join(' ')}
                            >
                                {!earned && (
                                    <LockSimpleIcon
                                        size={14}
                                        weight="bold"
                                        className="absolute top-2 right-2 text-text-muted"
                                    />
                                )}
                                {hasRecent && (
                                    <span className="absolute top-2 left-2 text-[9px] bg-amber-400 text-amber-950 font-bold rounded-full px-1.5 py-0.2">
                                        NEW
                                    </span>
                                )}
                                {earned && (
                                    <span className="absolute top-2 right-2 text-[10px] bg-primary/20 text-primary rounded-full px-1.5 py-0.5 font-medium">
                                        Lv {level}
                                    </span>
                                )}

                                <div className="w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center my-1">
                                    {icon.startsWith('/') ? (
                                        <img
                                            src={icon}
                                            alt={name}
                                            className="w-full h-full object-contain drop-shadow-sm"
                                        />
                                    ) : (
                                        <span className="text-4xl leading-none">{icon}</span>
                                    )}
                                </div>

                                <div className="w-full min-w-0">
                                    <p className="text-xs font-semibold text-text truncate">{name}</p>
                                    <p className="text-[10px] text-text-muted truncate mt-0.5">
                                        {t(def.descKey)}
                                    </p>
                                </div>
                            </button>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
