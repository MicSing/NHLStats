import type { Expense } from './expense'
import type { PointType } from './pointReason'

export interface UserSeasonStats {
    userId: number
    userName: string
    totalPlus: number
    totalMinus: number
    earnings: number
    bettingBalance: number
}

export interface TopRosterPlayer {
    rosterPlayerId: number
    firstName: string
    surname: string
    count: number
}

export interface UserGoalCount {
    userId: number
    userName: string
    count: number
}

export interface RosterScorerByUser {
    rosterPlayerId: number
    firstName: string
    surname: string
    teamShortName: string | null
    totalCount: number
    userCounts: UserGoalCount[]
}

export interface UserPenaltyCount {
    userId: number
    userName: string
    count: number
}

export interface RosterPenalizedByUser {
    rosterPlayerId: number
    firstName: string
    surname: string
    teamShortName: string | null
    totalCount: number
    userCounts: UserPenaltyCount[]
}

export interface WeeklyMatchUser {
    userId: number
    userName: string
    totalPlus: number
    totalMinus: number
    totalGoals: number
    totalPenalties: number
    betResult: 'Pending' | 'Won' | 'Lost' | 'Cancelled' | null
    betAmount: number | null
    betWonAmount: number | null
    betType: 'TeamWin' | 'UserGoal' | 'UserPenalty' | null
    betTargetName: string | null
}

export interface WeeklyMatch {
    matchId: number
    weekNumber: number
    matchDate: string
    homeTeamId: number
    homeTeamName: string | null
    homeTeamShortName: string | null
    awayTeamId: number
    awayTeamName: string | null
    awayTeamShortName: string | null
    homeScore: number
    awayScore: number
    completionType: number
    users: WeeklyMatchUser[]
}

export interface WeekGroup {
    weekNumber: number
    totalPlus: number
    totalMinus: number
    matches: WeeklyMatch[]
}

export interface UserEarnings {
    userId: number
    userName: string
    totalPlus: number
    totalMinus: number
    totalEarnings: number
    totalPaid: number
    remainingBalance: number
}

export interface AllTimeEarnings {
    userEarnings: { userId: number; earnings: number }[]
    totalCollected: number
    canBeCollected: number
    totalExpenses: number
}

export interface UserFinancialStats {
    userId: number
    totalPluses: number
    totalMinuses: number
    collected: number
    totalEarnings: number
    canBeCollected: number
    bettingBalance: number
    stakes: number
    betWins: number
    betLosses: number
    negativeCash: number
}

export interface FinancialStats {
    totalCollected: number
    totalExpenses: number
    canBeCollected: number
    totalEarnings: number
    expenses: Expense[]
    financesByUser: UserFinancialStats[]
}

export interface SeasonalUserEarnings {
    seasonId: number
    userEarnings: { userId: number; earnings: number }[]
}

export interface UserSeasonTotals {
    userId: number
    userName: string
    totalGoals: number
    totalPenalties: number
}

// --- Season Totals from /api/stats/season endpoint ---

export interface SeasonUserData {
    userId: number
    totalPlus: number
    totalMinus: number
    totalGoals: number
    totalPenalties: number
    earnings: number
    bettingBalance: number
}

export interface SeasonalUserData {
    seasonId: number
    usersData: SeasonUserData[]
}

export interface PlayerTopStats {
    name: string
    count: number
}

export interface SeasonTopRosterPlayers {
    seasonId: number
    topScorer: PlayerTopStats | null
    topPenalty: PlayerTopStats | null
    topPpScorer: PlayerTopStats | null
    topShScorer: PlayerTopStats | null
}

export interface SeasonTotals {
    usersData: SeasonalUserData[]
    topRosterPlayers: SeasonTopRosterPlayers[]
}

// Plus/minus trend per period (season or week)

export interface UserPeriodPlusMinus {
    userId: number
    userName: string
    totalPlus: number
    totalMinus: number
    matchesPlayed: number
}

export interface PeriodPlusMinus {
    label: string
    users: UserPeriodPlusMinus[]
    totalPeriodMatches: number
}

// --- Phase 6: User Stats types ---

export interface PointReasonBreakdownItem {
    pointReasonId: number
    pointReasonName: string
    pointType: PointType
    totalCount: number
}

export interface UserPointReasonBreakdown {
    userId: number
    userName: string
    items: PointReasonBreakdownItem[]
}

export interface HeadToHeadUserResult {
    userId: number
    userName: string
    totalPlus: number
    totalMinus: number
}

export interface HeadToHeadMatch {
    matchId: number
    seasonId: number
    seasonName: string
    matchDate: string
    homeTeamName: string
    homeTeamShortName: string
    awayTeamName: string
    awayTeamShortName: string
    homeScore: number
    awayScore: number
    completionType: number
    userResults: HeadToHeadUserResult[]
}

export interface MatchHistoryItem {
    matchDate: string
    opponentName: string
    opponentShortName: string
    homeScore: number
    awayScore: number
    isHome: boolean
    totalPlus: number
    totalMinus: number
    goalCount: number
    penaltyCount: number
}

export interface WeekMatchHistory {
    weekNumber: number
    totalPlus: number
    totalMinus: number
    goalCount: number
    penaltyCount: number
    matches: MatchHistoryItem[]
}

export interface SeasonMatchHistory {
    seasonId: number
    seasonName: string
    totalPlus: number
    totalMinus: number
    goalCount: number
    penaltyCount: number
    weeks: WeekMatchHistory[]
}

export interface DashboardData {
    seasonStats: SeasonStatsSummary[]
    earningsBySeason: SeasonalUserEarnings[]
    trendData: PeriodPlusMinus[]
    rosterScorers: RosterScorerBySeason[]
    rosterPenalized: RosterPenalizedBySeason[]

    allTimeStats: UserPerformanceMetrics[]
    allTimeEarnings: AllTimeEarnings
    allTimePlusMinusTrend: PeriodPlusMinus[]
    allTimeRosterScorers: AllTimeRosterScorer[]
    allTimeRosterPenalized: AllTimeRosterPenalized[]
}

export interface UserPerformanceMetrics {
    userId: number
    totalPlus: number
    totalMinus: number
}

export interface SeasonStatsSummary {
    seasonId: number
    userStats: UserPerformanceMetrics[]
}

export interface RosterScorerBySeason {
    rosterPlayerId: number
    seasonId: number
    firstName: string
    surname: string
    totalCount: number
    userCounts: UserGoalCount[]
}

export interface AllTimeRosterScorer {
    rosterPlayerId: number
    firstName: string
    surname: string
    totalCount: number
    userCounts: UserGoalCount[]
}

export interface RosterPenalizedBySeason {
    rosterPlayerId: number
    seasonId: number
    firstName: string
    surname: string
    totalCount: number
    userCounts: UserPenaltyCount[]
}

export interface AllTimeRosterPenalized {
    rosterPlayerId: number
    firstName: string
    surname: string
    totalCount: number
    userCounts: UserPenaltyCount[]
}
