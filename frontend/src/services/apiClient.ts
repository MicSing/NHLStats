// Empty string = relative URLs, so the Vite dev proxy (or same-origin in prod) handles routing.
// Override with VITE_API_BASE_URL for deployments that host API on a different domain.
const BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? ''

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
    // 204 No Content — return null (typed as T, callers should use T | null)
    if (response.status === 204) {
        return null as T
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
