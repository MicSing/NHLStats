// Keep in sync with backend/src/NHLStats.Domain/Entities/GamingConsole.cs
export const GamingConsole = {
    PlayStation: 'PlayStation',
    Xbox: 'Xbox',
} as const

export type GamingConsoleValue = typeof GamingConsole[keyof typeof GamingConsole]
