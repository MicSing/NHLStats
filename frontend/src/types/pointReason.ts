export interface PointReason {
    id: number
    name: string
    isPositive: boolean
    isActive: boolean
}

export interface CreatePointReasonDto {
    name: string
    isPositive: boolean
}

export interface UpdatePointReasonDto {
    name: string
    isPositive: boolean
    isActive: boolean
}
