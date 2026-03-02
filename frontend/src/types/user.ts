export interface User {
    id: number
    name: string
    isActive: boolean
}

export interface CreateUserDto {
    name: string
}

export interface UpdateUserDto {
    name: string
    isActive: boolean
}
