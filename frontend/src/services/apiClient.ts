// Empty string = relative URLs, so the Vite dev proxy (or same-origin in prod) handles routing.
// Override with VITE_API_BASE_URL for deployments that host API on a different domain.
const BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? ''

const TOKEN_REFRESH_THRESHOLD_MS = 5 * 60 * 1000

async function ensureFreshToken(): Promise<void> {
    const token = localStorage.getItem('token')
    if (!token) return

    try {
        const parts = token.split('.')
        if (parts.length !== 3) return
        const payload = JSON.parse(atob(parts[1])) as { exp?: number }
        const expMs = (payload.exp ?? 0) * 1000
        if (expMs - Date.now() > TOKEN_REFRESH_THRESHOLD_MS) return
    } catch {
        return
    }

    const response = await fetch(`${BASE_URL}/api/auth/refresh`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
    })

    if (!response.ok) {
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        window.location.href = '/login'
        throw new Error('Session expired')
    }

    const data = await response.json() as { token: string }
    localStorage.setItem('token', data.token)
}

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
        let message = `HTTP error ${response.status}`
        try {
            const body = await response.clone().json() as unknown
            if (typeof body === 'string') {
                message = body
            } else if (Array.isArray(body) && body.every((x) => typeof x === 'string')) {
                message = (body as string[]).join('; ')
            } else if (body && typeof body === 'object') {
                const obj = body as Record<string, unknown>
                if (typeof obj.error === 'string') message = obj.error
                else if (typeof obj.title === 'string') message = obj.title
                else if (obj.errors && typeof obj.errors === 'object') {
                    const flat = Object.values(obj.errors as Record<string, unknown>)
                        .flatMap((v) => Array.isArray(v) ? v : [v])
                        .filter((v) => typeof v === 'string')
                    if (flat.length > 0) message = flat.join('; ')
                }
            }
        } catch {
            // body not JSON; keep default message
        }
        throw new Error(message)
    }
    // 204 No Content — return null (typed as T, callers should use T | null)
    if (response.status === 204) {
        return null as T
    }
    return response.json() as Promise<T>
}

const apiClient = {
    async get<T>(path: string): Promise<T> {
        await ensureFreshToken()
        const response = await fetch(`${BASE_URL}${path}`, {
            headers: getHeaders(),
        })
        return handleResponse<T>(response)
    },

    async post<T>(path: string, body: unknown): Promise<T> {
        await ensureFreshToken()
        const response = await fetch(`${BASE_URL}${path}`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(body),
        })
        return handleResponse<T>(response)
    },

    async put<T>(path: string, body: unknown): Promise<T> {
        await ensureFreshToken()
        const response = await fetch(`${BASE_URL}${path}`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify(body),
        })
        return handleResponse<T>(response)
    },

    async delete<T>(path: string): Promise<T> {
        await ensureFreshToken()
        const response = await fetch(`${BASE_URL}${path}`, {
            method: 'DELETE',
            headers: getHeaders(),
        })
        return handleResponse<T>(response)
    },
}

export default apiClient
