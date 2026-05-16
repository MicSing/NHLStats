import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Plus } from '@phosphor-icons/react'
import { CompletionType } from '../../types/match'
import type { Match, CreateMatchDto, UpdateMatchDto, BatchCreateMatchDto } from '../../types/match'
import type { Team } from '../../types/team'
import type { User } from '../../types/user'
import apiClient from '../../services/apiClient'
import { useToast } from '../../context/ToastContext'
import Modal from '../Modal'
import SearchableSelect from '../SearchableSelect'
import SearchInput from '../SearchInput'
import Pagination from '../Pagination'
import CompletionBadge from '../CompletionBadge'
import LoadingSpinner from '../LoadingSpinner'
import useTable from '../../hooks/useTable'
import { TableCard, TableHead, ActionCell, PrimaryButton, SecondaryButton } from './SeasonPrimitives'
import { normalizeCompletionType } from './seasonUtils'

// ─── Bulk match creator ───────────────────────────────────────────────────────

interface ParsedRow {
    line: number
    homeRaw: string
    awayRaw: string
    homeTeamId: number | null
    awayTeamId: number | null
    homeTeamName: string | null
    awayTeamName: string | null
    matchDate: string | null
    homeScore: number | null
    awayScore: number | null
    completionType: CompletionType | null
    playerPoints: { userId: number; plus: number; minus: number }[] | null
    error: string | null
}

interface BulkMatchCreatorProps {
    seasonId: number
    teams: Team[]
    seasonUsers: User[]
    onSuccess: () => void
    onClose: () => void
}

function BulkMatchCreator({
    seasonId,
    teams,
    seasonUsers,
    onSuccess,
    onClose,
}: BulkMatchCreatorProps) {
    const { t } = useTranslation()
    const [csvText, setCsvText] = useState('')
    const [parsed, setParsed] = useState<ParsedRow[] | null>(null)
    const [perspectiveTeamId, setPerspectiveTeamId] = useState<number | ''>('')
    const [error, setError] = useState<string | null>(null)
    const [warn, setWarn] = useState(false)
    const [submitting, setSubmitting] = useState(false)

    const shortNameMap = new Map(teams.map((t) => [t.shortName.toUpperCase(), t]))
    const perspTeam =
        perspectiveTeamId !== '' ? (teams.find((t) => t.id === perspectiveTeamId) ?? null) : null

    const [t0, t1, t2] = teams
    const userPointSample =
        seasonUsers.length > 0
            ? Array.from({ length: Math.min(seasonUsers.length, 4) }, () => '0, 1').join(', ')
            : ''
    const detailSuffix = userPointSample
        ? `, ${userPointSample}, 4:3, OT, 4.11.2024`
        : ', 4:3, OT, 4.11.2024'
    const sampleCSV =
        perspTeam && t0 && t1
            ? `# ${perspTeam.shortName}'s schedule:\n@ ${perspTeam.id !== t0.id ? t0.shortName : t1.shortName}${detailSuffix}\nvs ${perspTeam.id !== t1.id ? t1.shortName : (t2?.shortName ?? 'BUF')}${detailSuffix}`
            : t0 && t1
              ? `${t1.shortName} @ ${t0.shortName}${detailSuffix}\n${t0.shortName} vs ${t1.shortName}${detailSuffix}`
              : `EDM @ COL${detailSuffix}\nCOL vs EDM${detailSuffix}`

    const parseLine = (
        raw: string,
        pt: typeof perspTeam,
    ): { homeRaw: string; awayRaw: string } | { err: string } | null => {
        const atSingle = raw.match(/^@\s+(.+)$/)
        if (atSingle) {
            if (!pt) return { err: 'Select "My team" above to use the @ single-team format' }
            return { homeRaw: atSingle[1].trim(), awayRaw: pt.shortName }
        }
        const vsSingle = raw.match(/^vs\.?\s+(.+)$/i)
        if (vsSingle) {
            if (!pt) return { err: 'Select "My team" above to use the vs single-team format' }
            return { homeRaw: pt.shortName, awayRaw: vsSingle[1].trim() }
        }
        const atTwo = raw.match(/^(.+?)\s*@\s*(.+)$/)
        if (atTwo) return { homeRaw: atTwo[2].trim(), awayRaw: atTwo[1].trim() }
        const vsTwo = raw.match(/^(.+?)\s+vs\.?\s+(.+)$/i)
        if (vsTwo) return { homeRaw: vsTwo[1].trim(), awayRaw: vsTwo[2].trim() }
        const parts = raw.split(',').map((p) => p.trim())
        if (parts.length >= 2) return { homeRaw: parts[0], awayRaw: parts[1] }
        return null
    }

    const parseCSV = (text: string): ParsedRow[] => {
        const datePattern = /^\d{1,2}\.\d{1,2}\.\d{4}$/
        const typePattern = /^(OT|REG|SO|NONE)$/i
        const scorePattern = /^\d+:\d+$/

        return text
            .split('\n')
            .map((line, i) => ({ raw: line.trim(), lineNum: i + 1 }))
            .filter(({ raw }) => raw.length > 0 && !raw.startsWith('#'))
            .map(({ raw, lineNum }) => {
                const parts = raw.split(',').map((p) => p.trim())
                const hasDetails =
                    parts.length >= 4 &&
                    datePattern.test(parts[parts.length - 1]) &&
                    typePattern.test(parts[parts.length - 2]) &&
                    scorePattern.test(parts[parts.length - 3])

                let matchRaw = raw
                let matchDate: string | null = null
                let homeScore: number | null = null
                let awayScore: number | null = null
                let completionType: CompletionType | null = null
                let playerPoints: { userId: number; plus: number; minus: number }[] | null = null

                if (hasDetails) {
                    matchRaw = parts[0]
                    const [d, m, y] = parts[parts.length - 1].split('.')
                    matchDate = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}T00:00:00`
                    const typeStr = parts[parts.length - 2].toUpperCase()
                    completionType =
                        typeStr === 'REG'
                            ? CompletionType.RegularTime
                            : typeStr === 'OT'
                              ? CompletionType.Overtime
                              : typeStr === 'SO'
                                ? CompletionType.Shootout
                                : CompletionType.None
                    const [hs, as] = parts[parts.length - 3].split(':')
                    homeScore = parseInt(hs)
                    awayScore = parseInt(as)
                    const playerParts = parts.slice(1, parts.length - 3)
                    if (playerParts.length > 0) {
                        if (playerParts.length % 2 !== 0) {
                            return {
                                line: lineNum,
                                homeRaw: matchRaw,
                                awayRaw: '',
                                homeTeamId: null,
                                awayTeamId: null,
                                homeTeamName: null,
                                awayTeamName: null,
                                matchDate,
                                homeScore,
                                awayScore,
                                completionType,
                                playerPoints: null,
                                error: `Player points must be in neg/pos pairs — got ${playerParts.length} value(s)`,
                            }
                        }
                        const pairCount = playerParts.length / 2
                        if (pairCount > seasonUsers.length) {
                            return {
                                line: lineNum,
                                homeRaw: matchRaw,
                                awayRaw: '',
                                homeTeamId: null,
                                awayTeamId: null,
                                homeTeamName: null,
                                awayTeamName: null,
                                matchDate,
                                homeScore,
                                awayScore,
                                completionType,
                                playerPoints: null,
                                error: `${pairCount} player pairs found but only ${seasonUsers.length} user(s) in season`,
                            }
                        }
                        playerPoints = []
                        for (let i = 0; i < pairCount; i++) {
                            const minus = parseInt(playerParts[i * 2])
                            const plus = parseInt(playerParts[i * 2 + 1])
                            if (isNaN(minus) || isNaN(plus)) {
                                return {
                                    line: lineNum,
                                    homeRaw: matchRaw,
                                    awayRaw: '',
                                    homeTeamId: null,
                                    awayTeamId: null,
                                    homeTeamName: null,
                                    awayTeamName: null,
                                    matchDate,
                                    homeScore,
                                    awayScore,
                                    completionType,
                                    playerPoints: null,
                                    error: `Invalid points at player ${i + 1}: "${playerParts[i * 2]}", "${playerParts[i * 2 + 1]}"`,
                                }
                            }
                            playerPoints.push({ userId: seasonUsers[i].id, plus, minus })
                        }
                    }
                }

                const result = parseLine(matchRaw, perspTeam)
                if (!result) {
                    return {
                        line: lineNum,
                        homeRaw: matchRaw,
                        awayRaw: '',
                        homeTeamId: null,
                        awayTeamId: null,
                        homeTeamName: null,
                        awayTeamName: null,
                        matchDate,
                        homeScore,
                        awayScore,
                        completionType,
                        playerPoints,
                        error: 'Unrecognised format — use: AWAY @ HOME | HOME vs AWAY | @ OPP | vs OPP',
                    }
                }
                if ('err' in result) {
                    return {
                        line: lineNum,
                        homeRaw: matchRaw,
                        awayRaw: '',
                        homeTeamId: null,
                        awayTeamId: null,
                        homeTeamName: null,
                        awayTeamName: null,
                        matchDate,
                        homeScore,
                        awayScore,
                        completionType,
                        playerPoints,
                        error: result.err,
                    }
                }
                const { homeRaw, awayRaw } = result
                const homeTeam = shortNameMap.get(homeRaw.toUpperCase()) ?? null
                const awayTeam = shortNameMap.get(awayRaw.toUpperCase()) ?? null
                const errors: string[] = []
                if (!homeTeam) errors.push(`Unknown home team "${homeRaw}"`)
                if (!awayTeam) errors.push(`Unknown away team "${awayRaw}"`)
                if (homeTeam && awayTeam && homeTeam.id === awayTeam.id)
                    errors.push('Home and away are the same team')
                return {
                    line: lineNum,
                    homeRaw,
                    awayRaw,
                    homeTeamId: homeTeam?.id ?? null,
                    awayTeamId: awayTeam?.id ?? null,
                    homeTeamName: homeTeam?.name ?? null,
                    awayTeamName: awayTeam?.name ?? null,
                    matchDate,
                    homeScore,
                    awayScore,
                    completionType,
                    playerPoints,
                    error: errors.length > 0 ? errors.join('; ') : null,
                }
            })
    }

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        const reader = new FileReader()
        reader.onload = (ev) => {
            const text = ev.target?.result as string
            setCsvText(text)
            setParsed(parseCSV(text))
            setWarn(false)
        }
        reader.readAsText(file)
    }

    const handleParseClick = () => {
        setParsed(parseCSV(csvText))
        setWarn(false)
        setError(null)
    }

    const validRows = parsed?.filter((r) => r.error === null) ?? []
    const invalidRows = parsed?.filter((r) => r.error !== null) ?? []

    const handleCreate = async () => {
        if (validRows.length === 0) return
        if (validRows.length > 82 && !warn) {
            setWarn(true)
            return
        }
        setSubmitting(true)
        setError(null)
        try {
            const dtos: BatchCreateMatchDto[] = validRows.map((r) => ({
                homeTeamId: r.homeTeamId as number,
                awayTeamId: r.awayTeamId as number,
                matchDate: r.matchDate,
                homeScore: r.homeScore ?? 0,
                awayScore: r.awayScore ?? 0,
                completionType: r.completionType ?? CompletionType.None,
                userPoints: r.playerPoints ?? undefined,
            }))
            await apiClient.post(`/api/seasons/${seasonId}/matches/batch`, dtos)
            onSuccess()
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : t('errors.batchCreateFailed')
            setError(msg)
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <div className="space-y-4 min-w-[480px]">
            <div className="bg-surface/50 rounded p-3 text-xs text-text space-y-1">
                <p className="font-semibold text-text">One match per line — formats supported:</p>
                <table className="mt-1 w-full border-separate" style={{ borderSpacing: '0 2px' }}>
                    <tbody>
                        <tr className="text-text-muted/70">
                            <td colSpan={2} className="pt-1 pb-0.5 font-semibold uppercase tracking-wider text-text-muted/70">
                                Single-team (requires "My team" below)
                            </td>
                        </tr>
                        <tr>
                            <td className="font-mono text-primary/80 pr-3 whitespace-nowrap">@ OPP</td>
                            <td className="text-text-muted">
                                My team travels to OPP — OPP is{' '}
                                <span className="text-white">home</span>, my team is away
                            </td>
                        </tr>
                        <tr>
                            <td className="font-mono text-primary/80 pr-3 whitespace-nowrap">vs OPP</td>
                            <td className="text-text-muted">
                                My team hosts OPP — my team is{' '}
                                <span className="text-white">home</span>, OPP is away
                            </td>
                        </tr>
                        <tr className="text-text-muted/70">
                            <td colSpan={2} className="pt-2 pb-0.5 font-semibold uppercase tracking-wider text-text-muted/70">
                                Explicit (both teams)
                            </td>
                        </tr>
                        <tr>
                            <td className="font-mono text-primary/80 pr-3 whitespace-nowrap">AWAY @ HOME</td>
                            <td className="text-text-muted">
                                Right side is home (e.g.{' '}
                                <span className="font-mono">EDM @ COL</span>)
                            </td>
                        </tr>
                        <tr>
                            <td className="font-mono text-primary/80 pr-3 whitespace-nowrap">HOME vs AWAY</td>
                            <td className="text-text-muted">
                                Left side hosts (e.g.{' '}
                                <span className="font-mono">COL vs EDM</span>)
                            </td>
                        </tr>
                        <tr className="text-text-muted/70">
                            <td colSpan={2} className="pt-2 pb-0.5 font-semibold uppercase tracking-wider text-text-muted/70">
                                Optional trailing fields (score, type, date &amp; player points)
                            </td>
                        </tr>
                        <tr>
                            <td
                                className="font-mono text-primary/80 pr-3 whitespace-nowrap"
                                style={{ verticalAlign: 'top' }}
                            >
                                …, SCORE, TYPE, DATE
                            </td>
                            <td className="text-text-muted">
                                Append score (<span className="font-mono">4:3</span>), type (
                                <span className="font-mono">REG</span>/
                                <span className="font-mono">OT</span>/
                                <span className="font-mono">SO</span>) and date (
                                <span className="font-mono">D.M.YYYY</span>)
                            </td>
                        </tr>
                        {seasonUsers.length > 0 && (
                            <tr>
                                <td
                                    className="font-mono text-primary/80 pr-3 whitespace-nowrap"
                                    style={{ verticalAlign: 'top' }}
                                >
                                    …, neg, pos, …
                                </td>
                                <td className="text-text-muted">
                                    Before score: one{' '}
                                    <span className="font-mono">neg, pos</span> pair per player in
                                    order below
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
                <p className="text-text-muted/70 pt-1">
                    Use team short codes (e.g.{' '}
                    <span className="font-mono text-text">COL</span>). Lines starting with{' '}
                    <span className="font-mono">#</span> are ignored.
                </p>
                {seasonUsers.length > 0 && (
                    <div className="mt-2 border-t border-border/50 pt-2">
                        <p className="font-semibold text-text-muted/70 uppercase tracking-wider text-xs mb-1">
                            Player column order
                        </p>
                        <div className="flex flex-wrap gap-x-4 gap-y-0.5">
                            {seasonUsers.map((u, i) => (
                                <span key={u.id} className="font-mono text-xs">
                                    <span className="text-text-muted/60">{i + 1}.</span>{' '}
                                    <span className="text-text">{u.name}</span>
                                </span>
                            ))}
                        </div>
                    </div>
                )}
                <details className="mt-1">
                    <summary className="cursor-pointer text-primary hover:text-primary/80">
                        Available short names
                    </summary>
                    <div className="mt-2 grid grid-cols-3 gap-x-4 gap-y-0.5 max-h-32 overflow-y-auto">
                        {teams.map((tm) => (
                            <span key={tm.id} className="font-mono text-xs">
                                <span className="text-primary/80">{tm.shortName}</span>
                                <span className="text-text-muted"> — {tm.name}</span>
                            </span>
                        ))}
                    </div>
                </details>
            </div>

            <div>
                <label className="label">
                    My team{' '}
                    <span className="text-text-muted/70">
                        (required for <span className="font-mono">@ OPP</span> /{' '}
                        <span className="font-mono">vs OPP</span> format)
                    </span>
                </label>
                <select
                    value={perspectiveTeamId}
                    onChange={(e) => {
                        setPerspectiveTeamId(e.target.value === '' ? '' : Number(e.target.value))
                        setParsed(null)
                        setWarn(false)
                    }}
                    className="bg-border border border-border rounded px-3 py-2 text-sm text-white w-full"
                >
                    <option value="">— not set (explicit formats only) —</option>
                    {teams.map((tm) => (
                        <option key={tm.id} value={tm.id}>
                            {tm.shortName} — {tm.name}
                        </option>
                    ))}
                </select>
            </div>

            <div className="flex items-center gap-3">
                <label className="text-sm text-text">Upload .csv file:</label>
                <input
                    type="file"
                    accept=".csv,text/csv,text/plain"
                    onChange={handleFileUpload}
                    className="text-xs text-text file:mr-2 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:bg-border file:text-text hover:file:bg-border/80"
                />
            </div>

            <div>
                <label className="label">{t('admin.matches.orPasteCsv', 'Or paste CSV:')}</label>
                <textarea
                    value={csvText}
                    onChange={(e) => {
                        setCsvText(e.target.value)
                        setParsed(null)
                        setWarn(false)
                    }}
                    rows={6}
                    placeholder={`# All three formats work:\n${sampleCSV}`}
                    className="w-full bg-border border border-border rounded px-3 py-2 text-sm font-mono text-white resize-y"
                />
            </div>

            <button
                type="button"
                onClick={handleParseClick}
                disabled={!csvText.trim()}
                className="bg-border hover:bg-border/80 px-4 py-2 rounded text-sm disabled:opacity-50"
            >
                {t('common.parse')}
            </button>

            {parsed !== null && (
                <div>
                    <p className="text-sm text-text mb-2">
                        <span className="text-success font-semibold">
                            {t('admin.matches.valid', { count: validRows.length })}
                        </span>
                        {invalidRows.length > 0 && (
                            <span className="text-danger font-semibold">
                                {' '}
                                · {t('admin.matches.errors', { count: invalidRows.length })}
                            </span>
                        )}
                    </p>
                    <div className="max-h-56 overflow-y-auto border border-border rounded">
                        <table className="w-full text-xs">
                            <thead className="bg-surface sticky top-0">
                                <tr className="text-left text-text-muted">
                                    <th className="px-2 py-1">#</th>
                                    <th className="px-2 py-1">Home</th>
                                    <th className="px-2 py-1">Away</th>
                                    <th className="px-2 py-1">Score</th>
                                    <th className="px-2 py-1">Type</th>
                                    <th className="px-2 py-1">Date</th>
                                    {seasonUsers.length > 0 && (
                                        <th className="px-2 py-1">Points</th>
                                    )}
                                    <th className="px-2 py-1">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {parsed.map((row) => (
                                    <tr
                                        key={row.line}
                                        className={`border-t border-border ${row.error ? 'bg-danger/20' : ''}`}
                                    >
                                        <td className="px-2 py-1 text-text-muted font-mono">
                                            {row.line}
                                        </td>
                                        <td className="px-2 py-1">
                                            {row.homeTeamName ? (
                                                <span>
                                                    {row.homeTeamName}{' '}
                                                    <span className="text-text-muted/70">
                                                        ({row.homeRaw})
                                                    </span>
                                                </span>
                                            ) : (
                                                <span className="text-danger font-mono">
                                                    {row.homeRaw}
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-2 py-1">
                                            {row.awayTeamName ? (
                                                <span>
                                                    {row.awayTeamName}{' '}
                                                    <span className="text-text-muted/70">
                                                        ({row.awayRaw})
                                                    </span>
                                                </span>
                                            ) : (
                                                <span className="text-danger font-mono">
                                                    {row.awayRaw}
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-2 py-1 font-mono text-text-muted">
                                            {row.homeScore !== null
                                                ? `${row.homeScore}:${row.awayScore}`
                                                : '—'}
                                        </td>
                                        <td className="px-2 py-1">
                                            {row.completionType !== null ? (
                                                <CompletionBadge type={row.completionType} />
                                            ) : (
                                                <span className="text-text-muted">—</span>
                                            )}
                                        </td>
                                        <td className="px-2 py-1 text-text-muted whitespace-nowrap">
                                            {row.matchDate
                                                ? new Date(row.matchDate).toLocaleDateString()
                                                : '—'}
                                        </td>
                                        {seasonUsers.length > 0 && (
                                            <td className="px-2 py-1">
                                                {row.playerPoints ? (
                                                    <span className="text-text-muted">
                                                        {row.playerPoints
                                                            .map((p) => `${p.minus}/${p.plus}`)
                                                            .join(' ')}
                                                    </span>
                                                ) : (
                                                    <span className="text-text-muted">—</span>
                                                )}
                                            </td>
                                        )}
                                        <td className="px-2 py-1">
                                            {row.error ? (
                                                <span className="text-danger">{row.error}</span>
                                            ) : (
                                                <span className="text-success">✓</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {warn && (
                <p className="text-yellow-400 text-sm">{t('admin.matches.exceedsWarning')}</p>
            )}
            {error && <p className="text-danger text-sm">{error}</p>}

            <div className="flex gap-3 pt-1">
                <button
                    type="button"
                    onClick={() => void handleCreate()}
                    disabled={submitting || validRows.length === 0}
                    className="bg-primary hover:bg-primary-hover px-4 py-2 rounded text-sm disabled:opacity-50"
                >
                    {warn
                        ? t('admin.matches.yesCreate', { count: validRows.length })
                        : t('admin.matches.importMatches', { count: validRows.length })}
                </button>
                <button
                    type="button"
                    onClick={onClose}
                    className="bg-border hover:bg-border/80 px-4 py-2 rounded text-sm"
                >
                    {t('common.cancel')}
                </button>
            </div>
        </div>
    )
}

// ─── Match forms ──────────────────────────────────────────────────────────────

interface CreateMatchFormProps {
    teams: Team[]
    form: CreateMatchDto
    onChange: (form: CreateMatchDto) => void
    onSubmit: (e: React.FormEvent) => void
    onCancel: () => void
}

function CreateMatchForm({ teams, form, onChange, onSubmit, onCancel }: CreateMatchFormProps) {
    const { t } = useTranslation()
    const teamOptions = teams.map((tm) => ({ value: tm.id, label: tm.name }))
    return (
        <form onSubmit={onSubmit} className="space-y-4">
            <div>
                <label className="label">{t('admin.matches.homeTeam')}</label>
                <SearchableSelect
                    options={teamOptions}
                    value={form.homeTeamId || ''}
                    onChange={(v) => onChange({ ...form, homeTeamId: v as number })}
                    placeholder={t('common.select')}
                />
            </div>
            <div>
                <label className="label">{t('admin.matches.awayTeam')}</label>
                <SearchableSelect
                    options={teamOptions}
                    value={form.awayTeamId || ''}
                    onChange={(v) => onChange({ ...form, awayTeamId: v as number })}
                    placeholder={t('common.select')}
                />
            </div>
            <div className="flex gap-3 pt-2">
                <button
                    type="submit"
                    disabled={!form.homeTeamId || !form.awayTeamId}
                    className="bg-primary hover:bg-primary-hover px-4 py-2 rounded text-sm disabled:opacity-50"
                >
                    {t('common.create')}
                </button>
                <button
                    type="button"
                    onClick={onCancel}
                    className="bg-border hover:bg-border/80 px-4 py-2 rounded text-sm"
                >
                    {t('common.cancel')}
                </button>
            </div>
        </form>
    )
}

interface EditMatchFormProps {
    teams: Team[]
    form: UpdateMatchDto
    onChange: (form: UpdateMatchDto) => void
    onSubmit: (e: React.FormEvent) => void
    onCancel: () => void
}

function EditMatchForm({ teams, form, onChange, onSubmit, onCancel }: EditMatchFormProps) {
    const { t } = useTranslation()
    const teamOptions = teams.map((tm) => ({ value: tm.id, label: tm.name }))
    return (
        <form onSubmit={onSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="label">{t('admin.matches.homeTeam')}</label>
                    <SearchableSelect
                        options={teamOptions}
                        value={form.homeTeamId || ''}
                        onChange={(v) => onChange({ ...form, homeTeamId: v as number })}
                        placeholder={t('common.select')}
                    />
                </div>
                <div>
                    <label className="label">{t('admin.matches.awayTeam')}</label>
                    <SearchableSelect
                        options={teamOptions}
                        value={form.awayTeamId || ''}
                        onChange={(v) => onChange({ ...form, awayTeamId: v as number })}
                        placeholder={t('common.select')}
                    />
                </div>
            </div>
            <div>
                <label className="label">{t('admin.matches.matchDate')}</label>
                <input
                    type="datetime-local"
                    value={form.matchDate ? form.matchDate.slice(0, 16) : ''}
                    onChange={(e) =>
                        onChange({
                            ...form,
                            matchDate: e.target.value ? e.target.value + ':00' : null,
                        })
                    }
                    className="bg-border border border-border rounded px-3 py-2 text-sm text-white w-full"
                />
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="label">{t('admin.matches.homeScore')}</label>
                    <input
                        type="number"
                        min={0}
                        value={form.homeScore}
                        onChange={(e) => onChange({ ...form, homeScore: Number(e.target.value) })}
                        className="bg-border border border-border rounded px-3 py-2 text-sm text-white w-full"
                    />
                </div>
                <div>
                    <label className="label">{t('admin.matches.awayScore')}</label>
                    <input
                        type="number"
                        min={0}
                        value={form.awayScore}
                        onChange={(e) => onChange({ ...form, awayScore: Number(e.target.value) })}
                        className="bg-border border border-border rounded px-3 py-2 text-sm text-white w-full"
                    />
                </div>
            </div>
            <div>
                <label className="label">{t('admin.matches.completion')}</label>
                <select
                    value={form.completionType}
                    onChange={(e) =>
                        onChange({
                            ...form,
                            completionType: Number(e.target.value) as CompletionType,
                        })
                    }
                    className="bg-border border border-border rounded px-3 py-2 text-sm text-white w-full"
                >
                    <option value={CompletionType.None}>{t('match.notPlayed')}</option>
                    <option value={CompletionType.RegularTime}>
                        {t('admin.matches.regularTime')}
                    </option>
                    <option value={CompletionType.Overtime}>{t('admin.matches.overtime')}</option>
                    <option value={CompletionType.Shootout}>{t('admin.matches.shootout')}</option>
                </select>
            </div>
            <div className="flex gap-3 pt-2">
                <button
                    type="submit"
                    disabled={!form.homeTeamId || !form.awayTeamId}
                    className="bg-primary hover:bg-primary-hover px-4 py-2 rounded text-sm disabled:opacity-50"
                >
                    {t('common.save')}
                </button>
                <button
                    type="button"
                    onClick={onCancel}
                    className="bg-border hover:bg-border/80 px-4 py-2 rounded text-sm"
                >
                    {t('common.cancel')}
                </button>
            </div>
        </form>
    )
}

// ─── Matches tab ──────────────────────────────────────────────────────────────

export interface MatchesTabProps {
    seasonId: number
    teams: Team[]
    seasonUsers: User[]
}

export default function MatchesTab({ seasonId, teams, seasonUsers }: MatchesTabProps) {
    const { t } = useTranslation()
    const toast = useToast()
    const [matches, setMatches] = useState<Match[]>([])
    const [loading, setLoading] = useState(false)
    const [showAddModal, setShowAddModal] = useState(false)
    const [editMatch, setEditMatch] = useState<Match | null>(null)
    const [showBulkModal, setShowBulkModal] = useState(false)
    const [createForm, setCreateForm] = useState<CreateMatchDto>({ homeTeamId: 0, awayTeamId: 0 })
    const [editForm, setEditForm] = useState<UpdateMatchDto>({
        homeTeamId: 0,
        awayTeamId: 0,
        matchDate: null,
        homeScore: 0,
        awayScore: 0,
        completionType: CompletionType.None,
    })

    const { pageItems, totalFiltered, search, setSearch, currentPage, setCurrentPage } = useTable({
        data: matches,
        searchFields: (m) => [m.homeTeamName ?? '', m.awayTeamName ?? ''],
    })

    const loadMatches = async (id: number) => {
        setLoading(true)
        try {
            const data = await apiClient.get<Match[]>(`/api/seasons/${id}/matches`)
            setMatches(data)
        } catch {
            // silently fail
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        void loadMatches(seasonId)
    }, [seasonId])

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault()
        try {
            await apiClient.post<Match>(`/api/seasons/${seasonId}/matches`, createForm)
            setShowAddModal(false)
            setCreateForm({ homeTeamId: 0, awayTeamId: 0 })
            toast.success(t('toast.createSuccess'))
            await loadMatches(seasonId)
        } catch {
            toast.error(t('toast.operationFailed'))
        }
    }

    const openEdit = (m: Match) => {
        setEditMatch(m)
        setEditForm({
            homeTeamId: m.homeTeamId,
            awayTeamId: m.awayTeamId,
            matchDate: m.matchDate,
            homeScore: m.homeScore,
            awayScore: m.awayScore,
            completionType: normalizeCompletionType(m.completionType),
        })
    }

    const handleEdit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!editMatch) return
        try {
            await apiClient.put<Match>(
                `/api/seasons/${seasonId}/matches/${editMatch.id}`,
                editForm,
            )
            setEditMatch(null)
            toast.success(t('toast.saveSuccess'))
            await loadMatches(seasonId)
        } catch {
            toast.error(t('toast.operationFailed'))
        }
    }

    const handleDelete = async (id: number) => {
        if (!window.confirm(t('admin.matches.deleteConfirm'))) return
        try {
            await apiClient.delete(`/api/seasons/${seasonId}/matches/${id}`)
            toast.success(t('toast.deleteSuccess'))
            await loadMatches(seasonId)
        } catch {
            toast.error(t('toast.operationFailed'))
        }
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">{t('admin.matches.title')}</h2>
                <div className="flex gap-2">
                    <SecondaryButton
                        label={t('admin.matches.bulkCreate')}
                        onClick={() => setShowBulkModal(true)}
                    />
                    <PrimaryButton
                        icon={<Plus size={16} />}
                        label={t('admin.matches.newMatch')}
                        onClick={() => setShowAddModal(true)}
                    />
                </div>
            </div>

            {loading ? (
                <LoadingSpinner size="sm" inline />
            ) : (
                <>
                    <SearchInput
                        value={search}
                        onChange={setSearch}
                        placeholder={t('common.search')}
                    />
                    <TableCard>
                        <TableHead
                            columns={[
                                '#',
                                t('admin.matches.match'),
                                t('admin.matches.score'),
                                t('common.date'),
                                t('common.status'),
                                t('common.actions'),
                            ]}
                        />
                        <tbody className="divide-y divide-border text-sm">
                            {pageItems.map((m) => (
                                <tr
                                    key={m.id}
                                    className="hover:bg-surface/50 transition-colors group"
                                >
                                    <td className="px-4 py-3 font-mono text-text-muted w-12">
                                        {m.matchNumber}
                                    </td>
                                    <td className="px-4 py-3">
                                        <Link
                                            to={`/seasons/${seasonId}/matches/${m.id}`}
                                            className="hover:text-primary"
                                        >
                                            {m.homeTeamName} vs {m.awayTeamName}
                                        </Link>
                                    </td>
                                    <td className="px-4 py-3 font-mono">
                                        {m.matchDate
                                            ? `${m.homeScore} – ${m.awayScore}`
                                            : '—'}
                                    </td>
                                    <td className="px-4 py-3 text-text-muted">
                                        {m.matchDate
                                            ? new Date(m.matchDate).toLocaleDateString()
                                            : t('admin.matches.tbd')}
                                    </td>
                                    <td className="px-4 py-3">
                                        <CompletionBadge type={normalizeCompletionType(m.completionType)} />
                                    </td>
                                    <ActionCell
                                        onEdit={() => openEdit(m)}
                                        onDelete={() => void handleDelete(m.id)}
                                        editTitle={t('common.edit')}
                                        deleteTitle={t('common.delete')}
                                    />
                                </tr>
                            ))}
                            {matches.length === 0 && (
                                <tr>
                                    <td
                                        colSpan={6}
                                        className="px-4 py-8 text-center text-text-muted text-sm"
                                    >
                                        {t('admin.matches.noMatches')}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </TableCard>
                    <Pagination
                        currentPage={currentPage}
                        totalItems={totalFiltered}
                        pageSize={20}
                        onPageChange={setCurrentPage}
                    />
                </>
            )}

            {showAddModal && (
                <Modal
                    title={t('admin.matches.newMatch')}
                    onClose={() => setShowAddModal(false)}
                >
                    <CreateMatchForm
                        teams={teams}
                        form={createForm}
                        onChange={setCreateForm}
                        onSubmit={(e) => void handleCreate(e)}
                        onCancel={() => setShowAddModal(false)}
                    />
                </Modal>
            )}

            {editMatch && (
                <Modal
                    title={t('admin.matches.editMatch', { number: editMatch.matchNumber })}
                    onClose={() => setEditMatch(null)}
                >
                    <EditMatchForm
                        teams={teams}
                        form={editForm}
                        onChange={setEditForm}
                        onSubmit={(e) => void handleEdit(e)}
                        onCancel={() => setEditMatch(null)}
                    />
                </Modal>
            )}

            {showBulkModal && (
                <Modal
                    title={t('admin.matches.bulkCreateTitle')}
                    onClose={() => setShowBulkModal(false)}
                >
                    <BulkMatchCreator
                        seasonId={seasonId}
                        teams={teams}
                        seasonUsers={seasonUsers}
                        onSuccess={() => {
                            setShowBulkModal(false)
                            void loadMatches(seasonId)
                        }}
                        onClose={() => setShowBulkModal(false)}
                    />
                </Modal>
            )}
        </div>
    )
}
