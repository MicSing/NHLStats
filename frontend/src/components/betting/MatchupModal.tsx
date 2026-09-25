import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { bettingService } from '../../services/bettingService'
import type { FutureMatch, Matchup, MatchupResult, UserMatchInfo } from '../../types/match'
import CompletionBadge from '../CompletionBadge'
import LoadingSpinner from '../LoadingSpinner'
import Modal from '../Modal'

interface MatchupModalProps {
    match: FutureMatch
    onClose: () => void
}

function names(users: UserMatchInfo[], fallback: string): string {
    return users.length === 0 ? '—' : users.map((u) => u.userName ?? fallback).join(', ')
}

function resultBorderClass(m: MatchupResult, hostedTeamId: number | null): string {
    const isHome = hostedTeamId != null && m.homeTeamId === hostedTeamId
    const isAway = hostedTeamId != null && m.awayTeamId === hostedTeamId
    if ((!isHome && !isAway) || m.homeScore === m.awayScore) return 'border-l-transparent'
    const won = isHome ? m.homeScore > m.awayScore : m.awayScore > m.homeScore
    return won ? 'border-l-success' : 'border-l-danger'
}

export default function MatchupModal({ match, onClose }: MatchupModalProps) {
    const { t } = useTranslation()
    const [matchup, setMatchup] = useState<Matchup | null>(null)
    const [failed, setFailed] = useState(false)

    useEffect(() => {
        let cancelled = false
        bettingService
            .getMatchup(match.id)
            .then((data) => { if (!cancelled) setMatchup(data) })
            .catch(() => { if (!cancelled) setFailed(true) })
        return () => { cancelled = true }
    }, [match.id])

    const home = match.homeTeamName ?? t('betting.unknownTeam')
    const away = match.awayTeamName ?? t('betting.unknownTeam')
    const unknownUser = t('betting.unknownUser')

    const leaders = matchup
        ? [
              { key: 'topScorer', label: t('betting.matchupTopScorer'), users: matchup.topScorers },
              { key: 'mostPenalized', label: t('betting.matchupMostPenalized'), users: matchup.mostPenalized },
              { key: 'mostPlus', label: t('betting.matchupMostPlus'), users: matchup.mostPlusPoints },
              { key: 'mostMinus', label: t('betting.matchupMostMinus'), users: matchup.mostMinusPoints },
          ]
        : []

    return (
        <Modal title={`${home} vs ${away}`} onClose={onClose} closeOnBackdropClick>
            {failed ? (
                <p className="text-sm text-danger">{t('betting.matchupLoadError')}</p>
            ) : !matchup ? (
                <LoadingSpinner size="sm" inline />
            ) : matchup.matchesPlayed === 0 ? (
                <p className="text-sm text-text-muted italic">{t('betting.matchupNoMatches')}</p>
            ) : (
                <div className="space-y-5">
                    <section>
                        <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted mb-2">
                            {t('betting.matchupLastResults', { played: matchup.matchesPlayed })}
                        </h3>
                        <ul className="space-y-1">
                            {matchup.lastMatches.map((m) => (
                                <li
                                    key={m.id}
                                    className={`flex items-center gap-3 px-3 py-2 border border-border border-l-4 ${resultBorderClass(m, match.hostedTeamId)} rounded bg-bg text-sm`}
                                >
                                    <span className="text-[10px] font-mono text-text-muted uppercase w-14 shrink-0">
                                        {t('betting.matchNumber', { number: m.matchNumber })}
                                    </span>
                                    <span className="flex-1 min-w-0 truncate text-right">
                                        {m.homeTeamName ?? t('betting.unknownTeam')}
                                    </span>
                                    <strong className="shrink-0 tabular-nums">
                                        {m.homeScore} : {m.awayScore}
                                    </strong>
                                    <span className="flex-1 min-w-0 truncate">
                                        {m.awayTeamName ?? t('betting.unknownTeam')}
                                    </span>
                                    <CompletionBadge type={m.completionType} />
                                </li>
                            ))}
                        </ul>
                    </section>

                    <section>
                        <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted mb-2">
                            {t('betting.matchupLeaders')}
                        </h3>
                        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {leaders.map((l) => (
                                <div key={l.key} className="px-3 py-2 border border-border rounded bg-bg">
                                    <dt className="text-[10px] uppercase tracking-wider text-text-muted">{l.label}</dt>
                                    <dd className="text-sm font-semibold">{names(l.users, unknownUser)}</dd>
                                </div>
                            ))}
                        </dl>
                    </section>
                </div>
            )}
        </Modal>
    )
}
