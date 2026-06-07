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
    id:             string
    earned:         boolean
    level:          number
    count:          number
    currentLevelAt: number
    nextLevelAt:    number | null
    occurrences:    AchievementOccurrence[]
}

export interface UserAchievements {
    achievements: AchievementResult[]
}
