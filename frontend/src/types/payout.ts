export interface UserPayout {
    id: number
    userId: number
    userName: string
    seasonId: number
    amount: number
    paidOn: string
}

export interface CreateUserPayoutDto {
    userId: number
    amount: number
    paidOn: string
}

export interface UpdateUserPayoutDto {
    amount: number
    paidOn: string
}
