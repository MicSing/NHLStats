import type { ReactNode } from 'react'

interface ModalProps {
    title: string
    onClose: () => void
    children: ReactNode
}

export default function Modal({ title, onClose, children }: ModalProps) {
    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
            className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50"
        >
            <div className="card w-full max-w-2xl shadow-card-hover flex flex-col max-h-[90vh] mx-4">
                <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
                    <h2 id="modal-title" className="text-lg font-semibold text-text">
                        {title}
                    </h2>
                    <button
                        onClick={onClose}
                        aria-label="Close modal"
                        className="text-text-muted hover:text-text text-2xl leading-none transition-colors"
                    >
                        ×
                    </button>
                </div>
                <div className="overflow-y-auto px-6 py-4 flex-1">
                    {children}
                </div>
            </div>
        </div>
    )
}
