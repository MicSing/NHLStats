const BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://localhost:5000'

function getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
    }
    const token = localStorage.getItem('token')
    if (token) {
        headers['Authorization'] = `Bearer ${token}`
    }
    return headers
}

async function handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`)
    }
    return response.json() as Promise<T>
}

const apiClient = {
    async get<T>(path: string): Promise<T> {
        const response = await fetch(`${BASE_URL}${path}`, {
            headers: getHeaders(),
        })
        return handleResponse<T>(response)
    },

    async post<T>(path: string, body: unknown): Promise<T> {
        const response = await fetch(`${BASE_URL}${path}`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(body),
        })
        return handleResponse<T>(response)
    },

    async put<T>(path: string, body: unknown): Promise<T> {
        const response = await fetch(`${BASE_URL}${path}`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify(body),
        })
        return handleResponse<T>(response)
    },

    async delete<T>(path: string): Promise<T> {
        const response = await fetch(`${BASE_URL}${path}`, {
            method: 'DELETE',
            headers: getHeaders(),
        })
        return handleResponse<T>(response)
    },
}

export default apiClient
