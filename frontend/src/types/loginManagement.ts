export interface LoginUser {
    id: string
    email: string
    userId: number | null
    roles: string[]
}

export interface CreateLoginDto {
    email: string
    password: string
    userId?: number
}

export interface UpdateLoginRolesDto {
    roles: string[]
}

export interface AttachUserDto {
    userId: number
}
