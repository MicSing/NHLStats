import { useState } from 'react'
import { LockSimpleIcon } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import type { AchievementResult, AchievementOccurrence } from '../../types/achievement'
import { ACHIEVEMENT_DEFS } from './achievementDefs'
import Modal from '../Modal'

interface Props {
    achievements: AchievementResult[]
    loading: boolean
}

function formatOccurrence(occ: AchievementOccurrence, valueLabel: string): string {
    const parts: string[] = []

    if (occ.occurredOn) {
        parts.push(new Date(occ.occurredOn).toLocaleDateString())
    }
    if (occ.weekNumber != null) {
        parts.push(`Week ${occ.weekNumber}`)
    }
    if (occ.seasonName) {
        parts.push(occ.seasonName)
    }
    if (occ.rosterPlayerName) {
        parts.push(occ.rosterPlayerName)
    }
    if (occ.value != null && valueLabel) {
        parts.push(`${occ.value} ${valueLabel}`)
    }

    return parts.join(' · ')
}

interface BadgeCardProps {
    def: (typeof ACHIEVEMENT_DEFS)[number]
    result: AchievementResult | undefined
    onClick: () => void
}

function BadgeCard({ def, result, onClick }: BadgeCardProps) {
    const level = result?.level ?? 0
    const earned = level > 0
    const idx = Math.max(0, level - 1)
    const icon = !earned && def.disabledIcon ? def.disabledIcon : def.levelIcons[idx]
    const name = def.levelNames[idx]

    return (
        <button
            onClick={onClick}
            className={[
                'rounded-xl p-3 border border-border flex flex-col items-center gap-2 text-center relative w-full transition-transform cursor-pointer',
                earned
                    ? 'bg-surface hover:scale-105'
                    : 'bg-surface opacity-35 grayscale',
            ].join(' ')}
        >
            {!earned && (
                <LockSimpleIcon
                    size={14}
                    weight="bold"
                    className="absolute top-2 right-2 text-text-muted"
                />
            )}
            {earned && (
                <span className="absolute top-2 right-2 text-[9px] bg-primary/20 text-primary rounded-full px-1.5 py-0.5 font-medium">
                    Lv {level}
                </span>
            )}
            {icon.startsWith('/') ? (
                <img src={icon} alt={name} className="w-28 h-28 object-contain" />
            ) : (
                <span className="text-8xl leading-none">{icon}</span>
            )}
            <span className="text-xs font-semibold text-text leading-tight">{name}</span>
        </button>
    )
}

export default function AchievementsTab({ achievements, loading }: Props) {
    const { t } = useTranslation()
    const [selected, setSelected] = useState<{ def: (typeof ACHIEVEMENT_DEFS)[number]; result: AchievementResult | undefined } | null>(null)

    if (loading) {
        return (
            <section className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                {Array.from({ length: 27 }).map((_, i) => (
                    <div key={i} className="animate-pulse bg-surface rounded-xl h-28 border border-border" />
                ))}
            </section>
        )
    }

    const resultById = Object.fromEntries(achievements.map((a) => [a.id, a]))

    const sorted = [...ACHIEVEMENT_DEFS].sort((a, b) => {
        const aLevel = resultById[a.id]?.level ?? 0
        const bLevel = resultById[b.id]?.level ?? 0
        return bLevel - aLevel
    })

    return (
        <>
            <section className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                {sorted.map((def) => (
                    <BadgeCard
                        key={def.id}
                        def={def}
                        result={resultById[def.id]}
                        onClick={() => setSelected({ def, result: resultById[def.id] })}
                    />
                ))}
            </section>

            {selected && (() => {
                const level = selected.result?.level ?? 0
                const name = level > 0 ? selected.def.levelNames[level - 1] : selected.def.levelNames[0]
                return (
                    <Modal
                        title={name}
                        onClose={() => setSelected(null)}
                    >
                        <p className="text-sm text-text-muted mb-4">{t(selected.def.descKey)}</p>
                        {selected.result && (
                            selected.result.occurrences.length === 0 ? (
                                <p className="text-sm text-text-muted">{t('achievements.noOccurrences')}</p>
                            ) : (
                                <ul className="space-y-2">
                                    {selected.result.occurrences.map((occ, i) => (
                                        <li
                                            key={i}
                                            className="text-sm text-text bg-bg rounded-lg px-4 py-2 border border-border"
                                        >
                                            {formatOccurrence(occ, selected.def.valueLabel)}
                                        </li>
                                    ))}
                                </ul>
                            )
                        )}
                    </Modal>
                )
            })()}
        </>
    )
}
