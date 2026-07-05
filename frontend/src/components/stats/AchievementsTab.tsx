import { useState } from 'react'
import { LockSimpleIcon } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import type { AchievementResult, AchievementOccurrence } from '../../types/achievement'
import { ACHIEVEMENT_DEFS } from './achievementDefs'
import Modal from '../Modal'

const TIER_COLORS = [
    'text-stone-400',
    'text-amber-700',
    'text-slate-400',
    'text-yellow-400',
    'text-emerald-400',
    'text-red-400',
    'text-sky-300',
] as const

interface Props {
    achievements: AchievementResult[]
    loading: boolean
}

function isRecent(date: string | null, days = 7): boolean {
    if (!date) return false
    return new Date(date) >= new Date(Date.now() - days * 86_400_000)
}

function formatOccurrence(occ: AchievementOccurrence, valueLabel: string): string {
    const parts: string[] = []

    if (occ.occurredOn) {
        parts.push(new Date(occ.occurredOn).toLocaleDateString('en-GB', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
        }).replace(/\//g, '.'))
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
    const { t } = useTranslation()
    const level = result?.level ?? 0
    const earned = level > 0
    const idx = Math.max(0, level - 1)
    const icon = !earned && def.disabledIcon ? def.disabledIcon : def.levelIcons[idx]
    const name = def.levelNames[idx]
    const hasNew = result?.occurrences.some(occ => isRecent(occ.occurredOn)) ?? false

    return (
        <button
            onClick={onClick}
            className={[
                'rounded-xl p-3 border border-border flex flex-col items-center gap-2 text-center relative w-full transition-transform cursor-pointer',
                earned
                    ? 'bg-surface hover:scale-105'
                    : 'bg-surface opacity-35 grayscale',
                hasNew ? 'ring-2 ring-amber-400/60' : '',
            ].join(' ')}
        >
            {!earned && (
                <LockSimpleIcon
                    size={14}
                    weight="bold"
                    className="absolute top-2 right-2 text-text-muted"
                />
            )}
            {hasNew && (
                <span className="absolute top-2 left-2 text-[9px] bg-amber-400/20 text-amber-400 rounded-full px-1.5 py-0.5 font-medium">
                    {t('achievements.new')}
                </span>
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

interface ModalProps {
    def: (typeof ACHIEVEMENT_DEFS)[number]
    result: AchievementResult | undefined
    onClose: () => void
}

function AchievementModal({ def, result, onClose }: ModalProps) {
    const { t } = useTranslation()
    const currentLevel = result?.level ?? 0
    const [viewLevel, setViewLevel] = useState(Math.max(1, currentLevel))

    const iconIdx = Math.max(0, viewLevel - 1)
    const icon = def.levelIcons[iconIdx]
    const name = def.levelNames[iconIdx]

    const count = result?.count ?? 0
    const currentLevelAt = result?.currentLevelAt ?? 0
    const nextLevelAt = result?.nextLevelAt ?? null
    const progressPct = nextLevelAt == null
        ? 100
        : Math.min(100, ((count - currentLevelAt) / (nextLevelAt - currentLevelAt)) * 100)

    return (
        <Modal title={name} onClose={onClose}>
            {/* Large icon */}
            <div className="flex justify-center mb-3">
                {icon.startsWith('/') ? (
                    <img src={icon} alt={name} className="w-32 h-32 object-contain" />
                ) : (
                    <span className="text-[7rem] leading-none">{icon}</span>
                )}
            </div>

            {/* Milestone level buttons */}
            <div className="flex justify-center gap-1.5 flex-wrap mb-4">
                {def.levelNames.map((lvlName, idx) => {
                    const lvl = idx + 1
                    const earned = lvl <= currentLevel
                    const active = lvl === viewLevel
                    return (
                        <button
                            key={lvl}
                            disabled={!earned}
                            onClick={() => setViewLevel(lvl)}
                            title={lvlName}
                            className={[
                                'rounded-full px-2.5 py-0.5 text-[10px] font-semibold border transition-all',
                                earned
                                    ? `${TIER_COLORS[idx]} border-current cursor-pointer`
                                    : 'text-text-muted border-border opacity-40 cursor-not-allowed',
                                active ? 'ring-2 ring-offset-1 ring-offset-surface ring-current scale-110' : '',
                            ].join(' ')}
                        >
                            Lv{lvl}
                        </button>
                    )
                })}
            </div>

            {/* Progress bar */}
            <div className="mb-4">
                <div className="flex justify-center text-xs text-text-muted mb-1">
                    {nextLevelAt == null
                        ? <span className="text-primary font-medium">{t('achievements.maxLevelReached')}</span>
                        : <span>{t('achievements.moreToNextLevel', { count: nextLevelAt - count })}</span>
                    }
                </div>
                <div className="h-2 rounded-full bg-border overflow-hidden">
                    <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{ width: `${progressPct}%` }}
                    />
                </div>
            </div>

            {/* Description */}
            <p className="text-sm text-text-muted mb-4">{t(def.descKey)}</p>

            {/* Occurrences */}
            {result && (
                result.occurrences.length === 0 ? (
                    <p className="text-sm text-text-muted">{t('achievements.noOccurrences')}</p>
                ) : (
                    <ul className="space-y-2">
                        {result.occurrences.map((occ, i) => {
                            const recent = isRecent(occ.occurredOn)
                            return (
                                <li
                                    key={i}
                                    className={[
                                        'text-sm text-text rounded-lg px-4 py-2 border flex items-center justify-between gap-2',
                                        recent
                                            ? 'bg-amber-400/10 border-amber-400/40'
                                            : 'bg-bg border-border',
                                    ].join(' ')}
                                >
                                    <span>{formatOccurrence(occ, def.valueLabel)}</span>
                                    {recent && (
                                        <span className="shrink-0 text-[9px] bg-amber-400/20 text-amber-400 rounded-full px-1.5 py-0.5 font-medium">
                                            {t('achievements.new')}
                                        </span>
                                    )}
                                </li>
                            )
                        })}
                    </ul>
                )
            )}
        </Modal>
    )
}

export default function AchievementsTab({ achievements, loading }: Props) {
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

            {selected && (
                <AchievementModal
                    def={selected.def}
                    result={selected.result}
                    onClose={() => setSelected(null)}
                />
            )}
        </>
    )
}
