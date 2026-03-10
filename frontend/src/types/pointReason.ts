export type PointType = 'Negative' | 'Positive' | 'Neutral'

export interface PointReason {
    id: number
    name: string
    pointType: PointType
    isActive: boolean
}

export interface CreatePointReasonDto {
    name: string
    pointType: PointType
}

export interface UpdatePointReasonDto {
    name: string
    pointType: PointType
    isActive: boolean
}
