export interface AchievementOccurrence {
    matchId:          number | null
    occurredOn:       string | null
    weekNumber:       number | null
    seasonId:         number | null
    seasonName:       string | null
    rosterPlayerName: string | null
    value:            number | null
}

export interface AchievementResult {
    id:          string
    earned:      boolean
    level:       number
    occurrences: AchievementOccurrence[]
}

export interface UserAchievements {
    achievements: AchievementResult[]
}
