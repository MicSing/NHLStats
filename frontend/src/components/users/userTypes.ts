import type { User } from '../../types/user'
import type { LoginUser } from '../../types/loginManagement'

export interface MergedUser extends User {
    logins: LoginUser[]
}
