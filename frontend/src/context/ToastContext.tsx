import { createContext, useCallback, useContext, useState } from 'react'
import type { ReactNode } from 'react'

type ToastVariant = 'success' | 'error' | 'warning' | 'info'

interface Toast {
    id: number
    message: string
    variant: ToastVariant
}

interface ToastContextType {
    showToast: (message: string, variant?: ToastVariant) => void
    success: (message: string) => void
    error: (message: string) => void
    warning: (message: string) => void
    info: (message: string) => void
}

const ToastContext = createContext<ToastContextType | null>(null)

let nextId = 0

export function ToastProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([])

    const showToast = useCallback((message: string, variant: ToastVariant = 'info') => {
        const id = ++nextId
        setToasts((prev) => [...prev, { id, message, variant }])
        setTimeout(() => {
            setToasts((prev) => prev.filter((t) => t.id !== id))
        }, 4000)
    }, [])

    const dismiss = useCallback((id: number) => {
        setToasts((prev) => prev.filter((t) => t.id !== id))
    }, [])

    const variantClasses: Record<ToastVariant, string> = {
        success: 'bg-success text-white',
        error: 'bg-danger text-white',
        warning: 'bg-warning text-white',
        info: 'bg-primary text-white',
    }

    const success = useCallback((message: string) => showToast(message, 'success'), [showToast])
    const error = useCallback((message: string) => showToast(message, 'error'), [showToast])
    const warning = useCallback((message: string) => showToast(message, 'warning'), [showToast])
    const info = useCallback((message: string) => showToast(message, 'info'), [showToast])

    return (
        <ToastContext.Provider value={{ showToast, success, error, warning, info }}>
            {children}
            {/* Toast container — fixed bottom-right */}
            <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
                {toasts.map((toast) => (
                    <div
                        key={toast.id}
                        role="alert"
                        className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-lg shadow-card-hover text-sm font-medium animate-slide-in ${variantClasses[toast.variant]}`}
                    >
                        <span className="flex-1">{toast.message}</span>
                        <button
                            onClick={() => dismiss(toast.id)}
                            className="opacity-70 hover:opacity-100 text-lg leading-none"
                            aria-label="dismiss"
                        >
                            ×
                        </button>
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useToast(): ToastContextType {
    const ctx = useContext(ToastContext)
    if (!ctx) throw new Error('useToast must be used within ToastProvider')
    return ctx
}
