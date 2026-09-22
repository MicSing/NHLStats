// Keep in sync with backend/src/NHLStats.Domain/Entities/SeasonUserPosition.cs
export const SEASON_USER_POSITIONS = ['LW', 'C', 'RW', 'LD', 'RD'] as const
export type SeasonUserPositionCode = (typeof SEASON_USER_POSITIONS)[number]
