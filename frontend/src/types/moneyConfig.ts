export interface MoneyConfig {
    id: number
    negativePointValue: number
    positivePointValue: number
    effectiveFrom: string
}

export interface CreateMoneyConfigDto {
    negativePointValue: number
    positivePointValue: number
    effectiveFrom: string
}
