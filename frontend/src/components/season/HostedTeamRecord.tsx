import { useTranslation } from 'react-i18next'
import type { Season } from '../../types/season'
import { teamLogoUrl } from '../../utils/teamLogoUrl'

interface HostedStats {
    W: number
    L: number
    OTL: number
    OT: number
    winsHome: number
    winsAway: number
    lossesHome: number
    lossesAway: number
}

interface Props {
    currentSeason: Season | null
    hostedTeamShortName: string | null
    hostedStats: HostedStats | null
}

export default function HostedTeamRecord({ currentSeason, hostedTeamShortName, hostedStats }: Props) {
    const { t } = useTranslation()

    if (!currentSeason?.hostedTeamId || !hostedStats) return null

    return (
        <section className="mb-8" aria-label="Hosted team record">
            <div className="bg-surface border border-border rounded-lg shadow-card">
                <div className="p-5 flex items-center gap-4 border-b border-border bg-bg rounded-t-lg">
                    {hostedTeamShortName && (
                        <img
                            src={teamLogoUrl(hostedTeamShortName)}
                            alt={currentSeason.hostedTeamName ?? ''}
                            className="w-10 h-10 object-contain"
                            onError={(e) => { ;(e.target as HTMLImageElement).style.display = 'none' }}
                        />
                    )}
                    <div>
                        <div className="text-[10px] text-text-muted uppercase tracking-widest font-bold mb-0.5">Team Overview</div>
                        <h2 className="text-xl font-bold">{currentSeason.hostedTeamName}</h2>
                    </div>
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-border">
                    <div className="p-5 flex justify-around items-center">
                        <div className="text-center">
                            <div className="text-[11px] font-bold text-text-muted uppercase tracking-widest mb-1">W</div>
                            <div className="text-3xl font-bold text-success tabular-nums">{hostedStats.W}</div>
                        </div>
                        <div className="w-px h-10 bg-border" />
                        <div className="text-center">
                            <div className="text-[11px] font-bold text-text-muted uppercase tracking-widest mb-1">L</div>
                            <div className="text-3xl font-bold text-danger tabular-nums">{hostedStats.L}</div>
                        </div>
                    </div>
                    <div className="p-5 flex justify-around items-center">
                        <div className="text-center">
                            <div className="text-[11px] font-bold text-text-muted uppercase tracking-widest mb-1">OTL</div>
                            <div className="text-2xl font-bold tabular-nums">{hostedStats.OTL}</div>
                        </div>
                        <div className="w-px h-8 bg-border" />
                        <div className="text-center">
                            <div className="text-[11px] font-bold text-text-muted uppercase tracking-widest mb-1">OT/SO</div>
                            <div className="text-2xl font-bold text-primary tabular-nums">{hostedStats.OT}</div>
                        </div>
                    </div>
                    <div className="p-5 flex justify-around items-center">
                        <div className="text-center">
                            <div className="text-[11px] font-bold text-text-muted uppercase tracking-widest mb-1">{t('season.winsHome')}</div>
                            <div className="text-xl font-bold text-success tabular-nums">{hostedStats.winsHome}</div>
                        </div>
                        <div className="w-px h-8 bg-border" />
                        <div className="text-center">
                            <div className="text-[11px] font-bold text-text-muted uppercase tracking-widest mb-1">{t('season.winsAway')}</div>
                            <div className="text-xl font-bold text-success tabular-nums">{hostedStats.winsAway}</div>
                        </div>
                    </div>
                    <div className="p-5 flex justify-around items-center">
                        <div className="text-center">
                            <div className="text-[11px] font-bold text-text-muted uppercase tracking-widest mb-1">{t('season.lossesHome')}</div>
                            <div className="text-xl font-bold text-danger tabular-nums">{hostedStats.lossesHome}</div>
                        </div>
                        <div className="w-px h-8 bg-border" />
                        <div className="text-center">
                            <div className="text-[11px] font-bold text-text-muted uppercase tracking-widest mb-1">{t('season.lossesAway')}</div>
                            <div className="text-xl font-bold text-danger tabular-nums">{hostedStats.lossesAway}</div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    )
}
