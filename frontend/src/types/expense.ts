export interface Expense {
    id: number
    description: string | null
    amount: number
    date: string
}

export interface CreateExpenseDto {
    description?: string | null
    amount: number
    date: string
}

export type UpdateExpenseDto = CreateExpenseDto
