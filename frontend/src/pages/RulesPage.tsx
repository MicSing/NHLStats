import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { PointReason } from '../types/pointReason'
import type { MoneyConfig } from '../types/moneyConfig'
import apiClient from '../services/apiClient'

export default function RulesPage() {
    const { t } = useTranslation()
    const [reasons, setReasons] = useState<PointReason[]>([])
    const [moneyConfig, setMoneyConfig] = useState<MoneyConfig | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    function getNegativeDescription(name: string): string {
        const key = `rules.negativeDescriptions.${name.toLowerCase()}`
        const val = t(key)
        return val === key ? '' : val
    }

    function getPositiveDescription(name: string): string {
        const key = `rules.positiveDescriptions.${name.toLowerCase()}`
        const val = t(key)
        return val === key ? '' : val
    }

    useEffect(() => {
        Promise.all([
            apiClient.get<PointReason[]>('/api/pointreasons'),
            apiClient.get<MoneyConfig>('/api/moneyconfig/current'),
        ])
            .then(([r, m]) => {
                setReasons(r)
                setMoneyConfig(m)
            })
            .catch(() => setError(t('errors.failedToLoadRules')))
            .finally(() => setLoading(false))
    }, []) // eslint-disable-line react-hooks/exhaustive-deps

    if (loading) return <p className="p-6 text-text-muted">{t('common.loading')}</p>
    if (error) return <p className="p-6 text-warning" role="alert">{error}</p>

    // Active reasons only, deduplicated by name (keep one entry per name)
    const activeReasons = reasons.filter((r) => r.isActive)
    const negativeReasons = activeReasons.filter((r) => r.pointType === 'Negative')
    const positiveReasons = activeReasons.filter((r) => r.pointType === 'Positive')
    const neutralReasons = activeReasons.filter((r) => r.pointType === 'Neutral')

    // Unique names across all active reasons (preserving negative order first)
    const seenNames = new Set<string>()
    const uniqueReasons: PointReason[] = []
    for (const r of [...negativeReasons, ...positiveReasons, ...neutralReasons]) {
        const key = r.name.toLowerCase()
        if (!seenNames.has(key)) {
            seenNames.add(key)
            uniqueReasons.push(r)
        }
    }

    return (
        <div className="p-6 max-w-3xl mx-auto space-y-8">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-primary mb-2">{t('rules.title')}</h1>
                <p className="text-text-muted text-sm leading-relaxed">
                    {t('rules.subtitle')}
                </p>
            </div>

            {/* Point value card */}
            {moneyConfig && (
                <div className="bg-surface rounded-xl border border-border p-5">
                    <h2 className="text-lg font-semibold text-text mb-4">{t('rules.currentPointValues')}</h2>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-bg rounded-lg p-4 text-center">
                            <p className="text-xs text-text-muted uppercase tracking-wider mb-1">{t('rules.negativePoint')}</p>
                            <p className="text-2xl font-bold text-warning">
                                −{moneyConfig.negativePointValue.toFixed(2)} €
                            </p>
                            <p className="text-xs text-text-muted mt-1">{t('rules.youPayPerNegative')}</p>
                        </div>
                        <div className="bg-bg rounded-lg p-4 text-center">
                            <p className="text-xs text-text-muted uppercase tracking-wider mb-1">{t('rules.positivePoint')}</p>
                            <p className="text-2xl font-bold text-primary">
                                +{moneyConfig.positivePointValue.toFixed(2)} €
                            </p>
                            <p className="text-xs text-text-muted mt-1">{t('rules.youEarnPerPositive')}</p>
                        </div>
                    </div>
                </div>
            )}

            {/* How it works */}
            <div className="bg-surface rounded-xl border border-border p-5">
                <h2 className="text-lg font-semibold text-text mb-3">{t('rules.howItWorks')}</h2>
                <ul className="space-y-2 text-sm text-text-muted list-disc list-inside leading-relaxed">
                    <li>{t('rules.howItWorksItem1')}</li>
                    <li>
                        {t('rules.howItWorksItem2Prefix')}{' '}
                        <span className="text-warning font-medium">{t('rules.negativePointLabel')}</span>{' '}
                        {t('common.or', 'or')}{' '}
                        <span className="text-primary font-medium">{t('rules.positivePointLabel')}</span>{' '}
                        {t('rules.howItWorksItem2Suffix')}
                    </li>
                </ul>
            </div>

            {/* Point reasons table */}
            <div className="bg-surface rounded-xl border border-border overflow-hidden">
                <div className="px-5 py-4 border-b border-border">
                    <h2 className="text-lg font-semibold text-text">{t('rules.pointReasons')}</h2>
                    <p className="text-xs text-text-muted mt-0.5">{t('rules.pointReasonsSubtitle')}</p>
                </div>
                <div className="divide-y divide-border">
                    {uniqueReasons.map((reason) => {
                        const hasNegative = negativeReasons.some(
                            (r) => r.name.toLowerCase() === reason.name.toLowerCase(),
                        )
                        const hasPositive = positiveReasons.some(
                            (r) => r.name.toLowerCase() === reason.name.toLowerCase(),
                        ) && getPositiveDescription(reason.name) !== ''
                        const hasNeutral = neutralReasons.some(
                            (r) => r.name.toLowerCase() === reason.name.toLowerCase(),
                        )
                        return (
                            <div key={reason.id} className="px-5 py-4">
                                <p className="font-semibold text-text text-sm mb-2">{reason.name}</p>
                                <div className="space-y-2">
                                    {hasNegative && (
                                        <div className="flex items-start gap-2">
                                            <span className="shrink-0 inline-flex items-center rounded-full bg-warning/10 px-2.5 py-0.5 text-xs font-semibold text-warning mt-0.5">
                                                {t('rules.negativeLabel')}
                                            </span>
                                            <p className="text-xs text-text-muted leading-relaxed">
                                                {getNegativeDescription(reason.name)}
                                            </p>
                                        </div>
                                    )}
                                    {hasPositive && (
                                        <div className="flex items-start gap-2">
                                            <span className="shrink-0 inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary mt-0.5">
                                                {t('rules.positiveLabel')}
                                            </span>
                                            <p className="text-xs text-text-muted leading-relaxed">
                                                {getPositiveDescription(reason.name)}
                                            </p>
                                        </div>
                                    )}
                                    {hasNeutral && (
                                        <div className="flex items-start gap-2">
                                            <span className="shrink-0 inline-flex items-center rounded-full bg-border px-2.5 py-0.5 text-xs font-semibold text-text-muted mt-0.5">
                                                {t('rules.neutralLabel')}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}
