import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Season } from '../../types/season'
import type { Team } from '../../types/team'
import { CompletionType } from '../../types/match'
import type { Match, CreateMatchDto, UpdateMatchDto } from '../../types/match'
import apiClient from '../../services/apiClient'
import Modal from '../../components/Modal'
import SearchableSelect from '../../components/SearchableSelect'

// ── Completion type badge ─────────────────────────────────────────────────────

function CompletionBadge({ type }: { type: CompletionType }) {
    const map: Record<CompletionType, { label: string; className: string }> = {
        [CompletionType.None]: { label: 'Not Played', className: 'bg-gray-600 text-gray-300' },
        [CompletionType.RegularTime]: { label: 'REG', className: 'bg-green-800 text-green-300' },
        [CompletionType.Overtime]: { label: 'OT', className: 'bg-yellow-800 text-yellow-300' },
        [CompletionType.Shootout]: { label: 'SO', className: 'bg-orange-800 text-orange-300' },
    }
    const { label, className } = map[type] ?? map[CompletionType.None]
    return (
        <span className={`text-xs px-2 py-0.5 rounded font-medium ${className}`}>{label}</span>
    )
}

// ── CSV Bulk creator ──────────────────────────────────────────────────────────

interface ParsedRow {
    line: number
    homeRaw: string
    awayRaw: string
    homeTeamId: number | null
    awayTeamId: number | null
    homeTeamName: string | null
    awayTeamName: string | null
    error: string | null
}

interface BulkMatchCreatorProps {
    seasonId: number
    teams: Team[]
    onSuccess: () => void
    onClose: () => void
}

function BulkMatchCreator({ seasonId, teams, onSuccess, onClose }: BulkMatchCreatorProps) {
    const [csvText, setCsvText] = useState('')
    const [parsed, setParsed] = useState<ParsedRow[] | null>(null)
    const [perspectiveTeamId, setPerspectiveTeamId] = useState<number | ''>('')
    const [error, setError] = useState<string | null>(null)
    const [warn, setWarn] = useState(false)
    const [submitting, setSubmitting] = useState(false)

    // Build lookup: shortName (uppercase) → team
    const shortNameMap = new Map(teams.map((t) => [t.shortName.toUpperCase(), t]))
    const perspTeam = perspectiveTeamId !== '' ? (teams.find((t) => t.id === perspectiveTeamId) ?? null) : null

    const [t0, t1, t2] = teams
    const sampleCSV = perspTeam && t0 && t1
        ? `# ${perspTeam.shortName}'s schedule (single-team format):\n@ ${perspTeam.id !== t0.id ? t0.shortName : t1.shortName}\nvs ${perspTeam.id !== t1.id ? t1.shortName : (t2?.shortName ?? 'BUF')}`
        : t0 && t1
            ? `${t0.shortName},${t1.shortName}\n${t1.shortName} @ ${t0.shortName}\n${t0.shortName} vs ${t1.shortName}`
            : 'COL,EDM\nEDM @ COL\nCOL vs EDM'

    // Parse one line into resolved home/away raw strings.
    // Single-token forms (@ OPP, vs OPP) need a perspTeam; returns an error string if missing.
    const parseLine = (
        raw: string,
        pt: typeof perspTeam,
    ): { homeRaw: string; awayRaw: string } | { err: string } | null => {
        // ── Single-team forms (no team before the keyword) ──────────────────
        // "@ OPP"  → perspective team travels to OPP (OPP is HOME, perspTeam is AWAY)
        const atSingle = raw.match(/^@\s+(.+)$/)
        if (atSingle) {
            if (!pt) return { err: 'Select "My team" above to use the @ single-team format' }
            return { homeRaw: atSingle[1].trim(), awayRaw: pt.shortName }
        }
        // "vs OPP" → perspective team hosts OPP (perspTeam is HOME, OPP is AWAY)
        const vsSingle = raw.match(/^vs\.?\s+(.+)$/i)
        if (vsSingle) {
            if (!pt) return { err: 'Select "My team" above to use the vs single-team format' }
            return { homeRaw: pt.shortName, awayRaw: vsSingle[1].trim() }
        }
        // ── Two-team explicit forms ──────────────────────────────────────────
        // "AWAY @ HOME"
        const atTwo = raw.match(/^(.+?)\s*@\s*(.+)$/)
        if (atTwo) return { homeRaw: atTwo[2].trim(), awayRaw: atTwo[1].trim() }
        // "HOME vs AWAY"
        const vsTwo = raw.match(/^(.+?)\s+vs\.?\s+(.+)$/i)
        if (vsTwo) return { homeRaw: vsTwo[1].trim(), awayRaw: vsTwo[2].trim() }
        // "HOME,AWAY"
        const parts = raw.split(',').map((p) => p.trim())
        if (parts.length >= 2) return { homeRaw: parts[0], awayRaw: parts[1] }
        return null
    }

    const parseCSV = (text: string): ParsedRow[] => {
        return text
            .split('\n')
            .map((line, i) => ({ raw: line.trim(), lineNum: i + 1 }))
            .filter(({ raw }) => raw.length > 0 && !raw.startsWith('#'))
            .map(({ raw, lineNum }) => {
                const result = parseLine(raw, perspTeam)
                if (!result) {
                    return {
                        line: lineNum, homeRaw: raw, awayRaw: '',
                        homeTeamId: null, awayTeamId: null,
                        homeTeamName: null, awayTeamName: null,
                        error: 'Unrecognised format — use: HOME,AWAY | AWAY @ HOME | HOME vs AWAY | @ OPP | vs OPP',
                    }
                }
                if ('err' in result) {
                    return {
                        line: lineNum, homeRaw: raw, awayRaw: '',
                        homeTeamId: null, awayTeamId: null,
                        homeTeamName: null, awayTeamName: null,
                        error: result.err,
                    }
                }
                const { homeRaw, awayRaw } = result
                const homeTeam = shortNameMap.get(homeRaw.toUpperCase()) ?? null
                const awayTeam = shortNameMap.get(awayRaw.toUpperCase()) ?? null
                const errors: string[] = []
                if (!homeTeam) errors.push(`Unknown home team "${homeRaw}"`)
                if (!awayTeam) errors.push(`Unknown away team "${awayRaw}"`)
                if (homeTeam && awayTeam && homeTeam.id === awayTeam.id) errors.push('Home and away are the same team')
                return {
                    line: lineNum,
                    homeRaw, awayRaw,
                    homeTeamId: homeTeam?.id ?? null,
                    awayTeamId: awayTeam?.id ?? null,
                    homeTeamName: homeTeam?.name ?? null,
                    awayTeamName: awayTeam?.name ?? null,
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
        const rows = parseCSV(csvText)
        setParsed(rows)
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
            const dtos: CreateMatchDto[] = validRows.map((r) => ({
                homeTeamId: r.homeTeamId as number,
                awayTeamId: r.awayTeamId as number,
            }))
            await apiClient.post(`/api/seasons/${seasonId}/matches/batch`, dtos)
            onSuccess()
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Batch create failed'
            setError(msg)
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <div className="space-y-4 min-w-[480px]">
            {/* Instructions */}
            <div className="bg-gray-700/50 rounded p-3 text-xs text-gray-300 space-y-1">
                <p className="font-semibold text-gray-200">One match per line — formats supported:</p>
                <table className="mt-1 w-full border-separate" style={{ borderSpacing: '0 2px' }}>
                    <tbody>
                        <tr className="text-gray-500">
                            <td colSpan={2} className="pt-1 pb-0.5 font-semibold uppercase tracking-wider text-gray-500">Single-team (requires "My team" below)</td>
                        </tr>
                        <tr>
                            <td className="font-mono text-cyan-300 pr-3 whitespace-nowrap">@ OPP</td>
                            <td className="text-gray-400">My team travels to OPP — OPP is <span className="text-white">home</span>, my team is away</td>
                        </tr>
                        <tr>
                            <td className="font-mono text-cyan-300 pr-3 whitespace-nowrap">vs OPP</td>
                            <td className="text-gray-400">My team hosts OPP — my team is <span className="text-white">home</span>, OPP is away</td>
                        </tr>
                        <tr className="text-gray-500">
                            <td colSpan={2} className="pt-2 pb-0.5 font-semibold uppercase tracking-wider text-gray-500">Explicit (both teams)</td>
                        </tr>
                        <tr>
                            <td className="font-mono text-cyan-300 pr-3 whitespace-nowrap">AWAY @ HOME</td>
                            <td className="text-gray-400">Right side is home (e.g. <span className="font-mono">EDM @ COL</span>)</td>
                        </tr>
                        <tr>
                            <td className="font-mono text-cyan-300 pr-3 whitespace-nowrap">HOME vs AWAY</td>
                            <td className="text-gray-400">Left side hosts (e.g. <span className="font-mono">COL vs EDM</span>)</td>
                        </tr>
                        <tr>
                            <td className="font-mono text-cyan-300 pr-3 whitespace-nowrap">HOME,AWAY</td>
                            <td className="text-gray-400">Comma — first is home</td>
                        </tr>
                    </tbody>
                </table>
                <p className="text-gray-500 pt-1">
                    Use team short codes (e.g. <span className="font-mono text-gray-200">COL</span>).
                    Lines starting with <span className="font-mono">#</span> are ignored.
                </p>
                <details className="mt-1">
                    <summary className="cursor-pointer text-cyan-400 hover:text-cyan-300">
                        Available short names
                    </summary>
                    <div className="mt-2 grid grid-cols-3 gap-x-4 gap-y-0.5 max-h-32 overflow-y-auto">
                        {teams.map((t) => (
                            <span key={t.id} className="font-mono text-xs">
                                <span className="text-cyan-300">{t.shortName}</span>
                                <span className="text-gray-400"> — {t.name}</span>
                            </span>
                        ))}
                    </div>
                </details>
            </div>

            {/* My team selector */}
            <div>
                <label className="block text-sm mb-1 text-gray-300">
                    My team <span className="text-gray-500">(required for <span className="font-mono">@ OPP</span> / <span className="font-mono">vs OPP</span> format)</span>
                </label>
                <select
                    value={perspectiveTeamId}
                    onChange={(e) => {
                        setPerspectiveTeamId(e.target.value === '' ? '' : Number(e.target.value))
                        setParsed(null)
                        setWarn(false)
                    }}
                    className="bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm text-white w-full"
                >
                    <option value="">— not set (explicit formats only) —</option>
                    {teams.map((t) => (
                        <option key={t.id} value={t.id}>
                            {t.shortName} — {t.name}
                        </option>
                    ))}
                </select>
            </div>

            {/* File upload */}
            <div className="flex items-center gap-3">
                <label className="text-sm text-gray-300">Upload .csv file:</label>
                <input
                    type="file"
                    accept=".csv,text/csv,text/plain"
                    onChange={handleFileUpload}
                    className="text-xs text-gray-300 file:mr-2 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:bg-gray-700 file:text-gray-200 hover:file:bg-gray-600"
                />
            </div>

            {/* Paste textarea */}
            <div>
                <label className="block text-sm mb-1 text-gray-300">Or paste CSV:</label>
                <textarea
                    value={csvText}
                    onChange={(e) => { setCsvText(e.target.value); setParsed(null); setWarn(false) }}
                    rows={6}
                    placeholder={`# All three formats work:\n${sampleCSV}`}
                    className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm font-mono text-white resize-y"
                />
            </div>

            <button
                type="button"
                onClick={handleParseClick}
                disabled={!csvText.trim()}
                className="bg-gray-600 hover:bg-gray-500 px-4 py-2 rounded text-sm disabled:opacity-50"
            >
                Parse
            </button>

            {/* Preview */}
            {parsed !== null && (
                <div>
                    <p className="text-sm text-gray-300 mb-2">
                        <span className="text-green-400 font-semibold">{validRows.length} valid</span>
                        {invalidRows.length > 0 && (
                            <span className="text-red-400 font-semibold"> · {invalidRows.length} errors</span>
                        )}
                    </p>
                    <div className="max-h-56 overflow-y-auto border border-gray-700 rounded">
                        <table className="w-full text-xs">
                            <thead className="bg-gray-800 sticky top-0">
                                <tr className="text-left text-gray-400">
                                    <th className="px-2 py-1">#</th>
                                    <th className="px-2 py-1">Home</th>
                                    <th className="px-2 py-1">Away</th>
                                    <th className="px-2 py-1">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {parsed.map((row) => (
                                    <tr
                                        key={row.line}
                                        className={`border-t border-gray-700 ${row.error ? 'bg-red-900/20' : ''}`}
                                    >
                                        <td className="px-2 py-1 text-gray-400 font-mono">{row.line}</td>
                                        <td className="px-2 py-1">
                                            {row.homeTeamName
                                                ? <span>{row.homeTeamName} <span className="text-gray-500">({row.homeRaw})</span></span>
                                                : <span className="text-red-400 font-mono">{row.homeRaw}</span>
                                            }
                                        </td>
                                        <td className="px-2 py-1">
                                            {row.awayTeamName
                                                ? <span>{row.awayTeamName} <span className="text-gray-500">({row.awayRaw})</span></span>
                                                : <span className="text-red-400 font-mono">{row.awayRaw}</span>
                                            }
                                        </td>
                                        <td className="px-2 py-1">
                                            {row.error
                                                ? <span className="text-red-400">{row.error}</span>
                                                : <span className="text-green-400">✓</span>
                                            }
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {warn && (
                <p className="text-yellow-400 text-sm">
                    ⚠ This exceeds a full NHL regular season (82 games) — continue?
                </p>
            )}

            {error && <p className="text-red-400 text-sm">{error}</p>}

            <div className="flex gap-3 pt-1">
                <button
                    type="button"
                    onClick={() => void handleCreate()}
                    disabled={submitting || validRows.length === 0}
                    className="bg-cyan-600 hover:bg-cyan-700 px-4 py-2 rounded text-sm disabled:opacity-50"
                >
                    {warn ? `Yes, Create ${validRows.length} Matches` : `Import ${validRows.length} Matches`}
                </button>
                <button
                    type="button"
                    onClick={onClose}
                    className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded text-sm"
                >
                    Cancel
                </button>
            </div>
        </div>
    )
}

// ── Create / Edit form ────────────────────────────────────────────────────────

interface CreateFormProps {
    teams: Team[]
    form: CreateMatchDto
    onChange: (form: CreateMatchDto) => void
    onSubmit: (e: React.FormEvent) => void
    onCancel: () => void
}

function CreateMatchForm({ teams, form, onChange, onSubmit, onCancel }: CreateFormProps) {
    const teamOptions = teams.map((t) => ({ value: t.id, label: t.name }))
    return (
        <form onSubmit={onSubmit} className="space-y-4">
            <div>
                <label className="block text-sm mb-1 text-gray-300">Home Team</label>
                <SearchableSelect
                    options={teamOptions}
                    value={form.homeTeamId || ''}
                    onChange={(v) => onChange({ ...form, homeTeamId: v as number })}
                    placeholder="Select home team"
                />
            </div>
            <div>
                <label className="block text-sm mb-1 text-gray-300">Away Team</label>
                <SearchableSelect
                    options={teamOptions}
                    value={form.awayTeamId || ''}
                    onChange={(v) => onChange({ ...form, awayTeamId: v as number })}
                    placeholder="Select away team"
                />
            </div>
            <div className="flex gap-3 pt-2">
                <button
                    type="submit"
                    disabled={!form.homeTeamId || !form.awayTeamId}
                    className="bg-cyan-600 hover:bg-cyan-700 px-4 py-2 rounded text-sm disabled:opacity-50"
                >
                    Create
                </button>
                <button
                    type="button"
                    onClick={onCancel}
                    className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded text-sm"
                >
                    Cancel
                </button>
            </div>
        </form>
    )
}

interface EditFormProps {
    teams: Team[]
    form: UpdateMatchDto
    onChange: (form: UpdateMatchDto) => void
    onSubmit: (e: React.FormEvent) => void
    onCancel: () => void
}

function EditMatchForm({ teams, form, onChange, onSubmit, onCancel }: EditFormProps) {
    const teamOptions = teams.map((t) => ({ value: t.id, label: t.name }))
    return (
        <form onSubmit={onSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm mb-1 text-gray-300">Home Team</label>
                    <SearchableSelect
                        options={teamOptions}
                        value={form.homeTeamId || ''}
                        onChange={(v) => onChange({ ...form, homeTeamId: v as number })}
                        placeholder="Select home team"
                    />
                </div>
                <div>
                    <label className="block text-sm mb-1 text-gray-300">Away Team</label>
                    <SearchableSelect
                        options={teamOptions}
                        value={form.awayTeamId || ''}
                        onChange={(v) => onChange({ ...form, awayTeamId: v as number })}
                        placeholder="Select away team"
                    />
                </div>
            </div>
            <div>
                <label className="block text-sm mb-1 text-gray-300">Match Date (optional)</label>
                <input
                    type="datetime-local"
                    value={form.matchDate ? form.matchDate.slice(0, 16) : ''}
                    onChange={(e) =>
                        onChange({
                            ...form,
                            matchDate: e.target.value ? e.target.value + ':00' : null,
                        })
                    }
                    className="bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm text-white w-full"
                />
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm mb-1 text-gray-300">Home Score</label>
                    <input
                        type="number"
                        min={0}
                        value={form.homeScore}
                        onChange={(e) => onChange({ ...form, homeScore: Number(e.target.value) })}
                        className="bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm text-white w-full"
                    />
                </div>
                <div>
                    <label className="block text-sm mb-1 text-gray-300">Away Score</label>
                    <input
                        type="number"
                        min={0}
                        value={form.awayScore}
                        onChange={(e) => onChange({ ...form, awayScore: Number(e.target.value) })}
                        className="bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm text-white w-full"
                    />
                </div>
            </div>
            <div>
                <label className="block text-sm mb-1 text-gray-300">Completion</label>
                <select
                    value={form.completionType}
                    onChange={(e) =>
                        onChange({ ...form, completionType: Number(e.target.value) as CompletionType })
                    }
                    className="bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm text-white w-full"
                >
                    <option value={CompletionType.None}>Not Played</option>
                    <option value={CompletionType.RegularTime}>Regular Time</option>
                    <option value={CompletionType.Overtime}>Overtime</option>
                    <option value={CompletionType.Shootout}>Shootout</option>
                </select>
            </div>
            <div className="flex gap-3 pt-2">
                <button
                    type="submit"
                    disabled={!form.homeTeamId || !form.awayTeamId}
                    className="bg-cyan-600 hover:bg-cyan-700 px-4 py-2 rounded text-sm disabled:opacity-50"
                >
                    Save
                </button>
                <button
                    type="button"
                    onClick={onCancel}
                    className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded text-sm"
                >
                    Cancel
                </button>
            </div>
        </form>
    )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AdminMatchesPage() {
    const [seasons, setSeasons] = useState<Season[]>([])
    const [teams, setTeams] = useState<Team[]>([])
    const [selectedSeasonId, setSelectedSeasonId] = useState<number | ''>('')
    const [matches, setMatches] = useState<Match[]>([])
    const [loadingSeasons, setLoadingSeasons] = useState(true)
    const [loadingMatches, setLoadingMatches] = useState(false)
    const [error, setError] = useState<string | null>(null)

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

    useEffect(() => {
        Promise.all([apiClient.get<Season[]>('/api/seasons'), apiClient.get<Team[]>('/api/teams')])
            .then(([s, t]) => {
                setSeasons(s)
                setTeams(t)
            })
            .catch(() => setError('Failed to load data'))
            .finally(() => setLoadingSeasons(false))
    }, [])

    const loadMatches = async (seasonId: number) => {
        setLoadingMatches(true)
        try {
            const data = await apiClient.get<Match[]>(`/api/seasons/${seasonId}/matches`)
            setMatches(data)
        } catch {
            setError('Failed to load matches')
        } finally {
            setLoadingMatches(false)
        }
    }

    const handleSeasonChange = (id: number | '') => {
        setSelectedSeasonId(id)
        if (id !== '') void loadMatches(id)
        else setMatches([])
    }

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault()
        if (selectedSeasonId === '') return
        await apiClient.post<Match>(`/api/seasons/${selectedSeasonId}/matches`, createForm)
        setShowAddModal(false)
        setCreateForm({ homeTeamId: 0, awayTeamId: 0 })
        await loadMatches(selectedSeasonId)
    }

    const openEdit = (m: Match) => {
        setEditMatch(m)
        setEditForm({
            homeTeamId: m.homeTeamId,
            awayTeamId: m.awayTeamId,
            matchDate: m.matchDate,
            homeScore: m.homeScore,
            awayScore: m.awayScore,
            completionType: m.completionType,
        })
    }

    const handleEdit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!editMatch || selectedSeasonId === '') return
        await apiClient.put<Match>(
            `/api/seasons/${selectedSeasonId}/matches/${editMatch.id}`,
            editForm,
        )
        setEditMatch(null)
        await loadMatches(selectedSeasonId as number)
    }

    const handleDelete = async (id: number) => {
        if (selectedSeasonId === '' || !window.confirm('Delete this match?')) return
        await apiClient.delete(`/api/seasons/${selectedSeasonId}/matches/${id}`)
        await loadMatches(selectedSeasonId as number)
    }

    if (loadingSeasons) return <p>Loading…</p>
    if (error) return <p role="alert">{error}</p>

    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold text-cyan-400">Matches</h1>
            </div>

            {/* Season selector */}
            <div className="mb-6">
                <label htmlFor="match-season-select" className="block text-sm mb-1 text-gray-300">
                    Season
                </label>
                <select
                    id="match-season-select"
                    value={selectedSeasonId}
                    onChange={(e) =>
                        handleSeasonChange(e.target.value === '' ? '' : Number(e.target.value))
                    }
                    className="bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm text-white min-w-48"
                >
                    <option value="">Select a season…</option>
                    {seasons.map((s) => (
                        <option key={s.id} value={s.id}>
                            {s.name}
                        </option>
                    ))}
                </select>
            </div>

            {selectedSeasonId !== '' && (
                <>
                    <div className="flex gap-2 mb-4">
                        <button
                            onClick={() => setShowAddModal(true)}
                            className="bg-cyan-600 hover:bg-cyan-700 px-4 py-2 rounded text-sm"
                        >
                            New Match
                        </button>
                        <button
                            onClick={() => setShowBulkModal(true)}
                            className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded text-sm"
                        >
                            Bulk Create
                        </button>
                    </div>

                    {loadingMatches ? (
                        <p>Loading matches…</p>
                    ) : (
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-left border-b border-gray-700 text-gray-400">
                                    <th className="pb-2 pr-3">#</th>
                                    <th className="pb-2 pr-3">Match</th>
                                    <th className="pb-2 pr-3">Score</th>
                                    <th className="pb-2 pr-3">Date</th>
                                    <th className="pb-2 pr-3">Status</th>
                                    <th className="pb-2">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {matches.map((m) => (
                                    <tr key={m.id} className="border-b border-gray-700/50">
                                        <td className="py-3 pr-3 font-mono text-gray-400">
                                            {m.matchNumber}
                                        </td>
                                        <td className="py-3 pr-3">
                                            <Link
                                                to={`/seasons/${selectedSeasonId}/matches/${m.id}`}
                                                className="hover:text-cyan-400"
                                            >
                                                {m.homeTeamName} vs {m.awayTeamName}
                                            </Link>
                                        </td>
                                        <td className="py-3 pr-3 font-mono">
                                            {m.matchDate
                                                ? `${m.homeScore} – ${m.awayScore}`
                                                : '—'}
                                        </td>
                                        <td className="py-3 pr-3 text-gray-300">
                                            {m.matchDate
                                                ? new Date(m.matchDate).toLocaleDateString()
                                                : 'TBD'}
                                        </td>
                                        <td className="py-3 pr-3">
                                            <CompletionBadge type={m.completionType} />
                                        </td>
                                        <td className="py-3 flex gap-2">
                                            <button
                                                onClick={() => openEdit(m)}
                                                className="text-xs bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded"
                                            >
                                                Edit
                                            </button>
                                            <button
                                                onClick={() => void handleDelete(m.id)}
                                                className="text-xs bg-red-900 hover:bg-red-800 px-3 py-1 rounded"
                                            >
                                                Delete
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {matches.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="py-4 text-gray-400 text-center">
                                            No matches yet.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    )}
                </>
            )}

            {/* Create modal */}
            {showAddModal && (
                <Modal title="New Match" onClose={() => setShowAddModal(false)}>
                    <CreateMatchForm
                        teams={teams}
                        form={createForm}
                        onChange={setCreateForm}
                        onSubmit={(e) => void handleCreate(e)}
                        onCancel={() => setShowAddModal(false)}
                    />
                </Modal>
            )}

            {/* Edit modal */}
            {editMatch && (
                <Modal
                    title={`Edit Match #${editMatch.matchNumber}`}
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

            {/* Bulk create modal */}
            {showBulkModal && selectedSeasonId !== '' && (
                <Modal title="Bulk Create Matches" onClose={() => setShowBulkModal(false)}>
                    <BulkMatchCreator
                        seasonId={selectedSeasonId as number}
                        teams={teams}
                        onSuccess={() => {
                            setShowBulkModal(false)
                            void loadMatches(selectedSeasonId as number)
                        }}
                        onClose={() => setShowBulkModal(false)}
                    />
                </Modal>
            )}
        </div>
    )
}
