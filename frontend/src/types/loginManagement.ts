export interface LoginUser {
    id: string
    email: string | null
    alias: string | null
    userId: number | null
    roles: string[]
}

export interface CreateLoginDto {
    email?: string
    alias?: string
    password: string
    userId?: number
}

export interface UpdateLoginRolesDto {
    roles: string[]
}

export interface AttachUserDto {
    userId: number
}
