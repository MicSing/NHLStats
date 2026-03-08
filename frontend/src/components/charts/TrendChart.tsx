import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
} from 'recharts'
import type { PeriodPlusMinus } from '../../types/stats'
import { useChartTheme } from './useChartTheme'
import { useTranslation } from 'react-i18next'

const USER_COLORS = [
    '#06b6d4', // cyan
    '#f97316', // orange
    '#a855f7', // purple
    '#22c55e', // green
    '#eab308', // yellow
    '#ec4899', // pink
    '#14b8a6', // teal
    '#64748b', // slate
    '#ef4444', // red
    '#3b82f6', // blue
]

type Mode = 'plus' | 'minus'

interface Props {
    data: PeriodPlusMinus[]
    mode: Mode
    isWeekly: boolean // True when viewing a specific season (weekly breakdown), false for all-time (by-season)
    totalPeriodMatches?: number // Total matches in current season from API
}

/**
 * Calculate pace (points per match) for a user
 */
function calculatePace(points: number, matches: number): number {
    return matches > 0 ? points / matches : 0
}

/**
 * Calculate historical pace: average pace of all previous periods (excluding current)
 */
function calculateHistoricalPace(
    data: PeriodPlusMinus[],
    userId: number,
    getValue: (u: { totalPlus: number; totalMinus: number }) => number,
    currentPeriodIndex: number
): number {
    const previousPeriods = data.slice(0, currentPeriodIndex)
    if (previousPeriods.length === 0) return 0

    let totalPace = 0
    let count = 0

    for (const period of previousPeriods) {
        const user = period.users.find(u => u.userId === userId)
        if (user && user.matchesPlayed > 0) {
            totalPace += calculatePace(getValue(user), user.matchesPlayed)
            count++
        }
    }

    return count > 0 ? totalPace / count : 0
}

/**
 * Calculate last N periods pace
 */
function calculateLastNPeriodsPace(
    data: PeriodPlusMinus[],
    userId: number,
    getValue: (u: { totalPlus: number; totalMinus: number }) => number,
    n: number
): number {
    const recentPeriods = data.slice(Math.max(0, data.length - n))
    let totalPoints = 0
    let totalMatches = 0

    for (const period of recentPeriods) {
        const user = period.users.find(u => u.userId === userId)
        if (user) {
            totalPoints += getValue(user)
            totalMatches += user.matchesPlayed
        }
    }

    return calculatePace(totalPoints, totalMatches)
}

export default function TrendChart({ data, mode, isWeekly }: Props) {
    const ct = useChartTheme()
    const { t } = useTranslation()
    const ariaLabel = mode === 'plus' ? 'plus trend chart' : 'minus trend chart'

    if (data.length === 0) {
        return (
            <div role="img" aria-label={ariaLabel} className="w-full">
                <p className="text-text-muted text-sm text-center py-8">{t('trendChart.noData')}</p>
            </div>
        )
    }

    // Collect all unique users across all periods
    const userMap = new Map<number, string>()
    for (const period of data) {
        for (const u of period.users) {
            if (!userMap.has(u.userId)) {
                userMap.set(u.userId, u.userName)
            }
        }
    }
    const allUsers = Array.from(userMap.entries()).map(([userId, userName]) => ({
        userId,
        userName,
    }))

    // Extract the value for the chosen mode (always >= 0)
    const getValue = (u: { totalPlus: number; totalMinus: number }) =>
        mode === 'plus' ? u.totalPlus : u.totalMinus

    // Build chart data: each point is a period, with one key per user
    const chartData: Record<string, unknown>[] = data.map((period) => {
        const entry: Record<string, unknown> = { label: period.label }
        for (const user of allUsers) {
            const match = period.users.find((u) => u.userId === user.userId)
            entry[user.userName] = match ? getValue(match) : 0
        }
        return entry
    })

    // Predict next period using pace-based predictions per user
    const predictionEntry: Record<string, unknown> = {
        label: t('trendChart.nextPredicted'),
        _isPrediction: true,
    }

    const currentPeriodIndex = data.length - 1

    const getSeasonMatchesForUser = (userId: number): number =>
        data.reduce((sum, period) => {
            const u = period.users.find((p) => p.userId === userId)
            return sum + (u?.matchesPlayed || 0)
        }, 0)

    // Use provided totalSeasonMatches or fallback to 82
    const FULL_SEASON_MATCHES = 82

    // Calculate total matches played across all users in the season
    const totalSeasonMatchesPlayed = allUsers.reduce((sum, u) => {
        return sum + getSeasonMatchesForUser(u.userId)
    }, 0) / allUsers.length // Average to get total season matches played

    // maxSeasonMatches = full season
    // matchesRemainingInSeason = full season - matches already played in season
    const maxSeasonMatches = FULL_SEASON_MATCHES;
    const matchesRemainingInSeason = Math.max(0, maxSeasonMatches - totalSeasonMatchesPlayed);

    for (const user of allUsers) {
        const currentUser = data[currentPeriodIndex]?.users.find((u) => u.userId === user.userId);

        const currentSeasonMatches = getSeasonMatchesForUser(user.userId);
        if (currentSeasonMatches === 0) {
            predictionEntry[user.userName] = 0;
            continue;
        }

        // Calculate current period pace
        // For season view: only current season (last period)
        // For weekly view: all weeks in current season
        const currentSeasonPace = isWeekly
            ? calculateLastNPeriodsPace(data, user.userId, getValue, data.length)
            : calculateLastNPeriodsPace(data, user.userId, getValue, 1);

        // Calculate historical pace (average of all previous periods)
        const historicalPace = calculateHistoricalPace(data, user.userId, getValue, currentPeriodIndex);

        let predictedPace: number;

        if (isWeekly && data.length >= 4) {
            // Weekly with >= 4 weeks: 50% last 4 weeks + 30% current season + 20% historical
            const last4WeeksPace = calculateLastNPeriodsPace(data, user.userId, getValue, 4);

            predictedPace = 0.5 * last4WeeksPace + 0.3 * currentSeasonPace + 0.2 * historicalPace;
        } else {
            // Season or < 4 weeks fallback: 80% current season + 20% historical
            predictedPace = 0.8 * currentSeasonPace + 0.2 * historicalPace;
        }

        // For season view: predict end-of-season total (82 games)
        // For weekly view: predict next week based on recent match frequency
        const matchesLastWeek = currentUser?.matchesPlayed ?? 0;
        const weeklyMultiplier = Math.min(matchesLastWeek, matchesRemainingInSeason);
        const multiplier = isWeekly ? weeklyMultiplier : maxSeasonMatches;
        const predictedPoints = predictedPace * multiplier;

        // Clamp to 0 (can't be negative)
        predictionEntry[user.userName] = Math.max(0, Math.round(predictedPoints));
    }

    const chartDataWithPrediction = [...chartData, predictionEntry];

    return (
        <div role="img" aria-label={ariaLabel} className="w-full">
            <ResponsiveContainer width="100%" height={280}>
                <LineChart
                    data={chartDataWithPrediction}
                    margin={{ top: 10, right: 30, left: 0, bottom: 5 }}
                >
                    <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} />
                    <XAxis
                        dataKey="label"
                        tick={{ fill: ct.tick, fontSize: 11 }}
                        angle={-20}
                        textAnchor="end"
                        height={60}
                    />
                    <YAxis
                        tick={{ fill: ct.tick, fontSize: 12 }}
                        domain={[0, 'auto']}
                        allowDecimals={false}
                    />
                    <Tooltip
                        contentStyle={{
                            backgroundColor: ct.tooltipBg,
                            border: `1px solid ${ct.tooltipBorder}`,
                            color: ct.tooltipText,
                        }}
                    />
                    <Legend wrapperStyle={{ color: ct.legendText, fontSize: 12 }} />

                    {allUsers.map((user, i) => (
                        <Line
                            key={user.userId}
                            type="monotone"
                            dataKey={user.userName}
                            stroke={USER_COLORS[i % USER_COLORS.length]}
                            strokeWidth={2}
                            dot={(props: Record<string, unknown>) => {
                                const { cx, cy, index } = props as {
                                    cx: number
                                    cy: number
                                    index: number
                                }
                                if (index === chartDataWithPrediction.length - 1) {
                                    // Prediction dot — hollow dashed circle
                                    return (
                                        <circle
                                            cx={cx}
                                            cy={cy}
                                            r={4}
                                            fill="none"
                                            stroke={USER_COLORS[i % USER_COLORS.length]}
                                            strokeWidth={2}
                                            strokeDasharray="3 2"
                                        />
                                    )
                                }
                                return (
                                    <circle
                                        cx={cx}
                                        cy={cy}
                                        r={4}
                                        fill={USER_COLORS[i % USER_COLORS.length]}
                                        stroke="none"
                                    />
                                )
                            }}
                            activeDot={false}
                            connectNulls
                        />
                    ))}
                </LineChart>
            </ResponsiveContainer>

            {/* Prediction note */}
            <p className="text-text-muted text-xs text-center mt-1 italic">
                {t('trendChart.predictionNote')}
            </p>

            {/* Accessible data summary */}
            <ul className="flex flex-wrap gap-x-6 gap-y-1 mt-2 text-xs text-text-muted">
                {allUsers.map((user, i) => {
                    const latestPeriod = data[data.length - 1]
                    const latestMatch = latestPeriod?.users.find((u) => u.userId === user.userId)
                    const latestValue = latestMatch ? getValue(latestMatch) : 0
                    const predicted = predictionEntry[user.userName] as number
                    return (
                        <li key={user.userId}>
                            <span
                                className="inline-block w-2 h-2 rounded-full mr-1"
                                style={{ backgroundColor: USER_COLORS[i % USER_COLORS.length] }}
                            />
                            <span className="font-medium text-text">{user.userName}</span>{' '}
                            <span className={mode === 'plus' ? 'text-primary' : 'text-danger'}>
                                {latestValue}
                            </span>
                            <span className="text-text-muted"> → {predicted}</span>
                        </li>
                    )
                })}
            </ul>
        </div>
    )
}
