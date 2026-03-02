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
            className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
        >
            <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md shadow-xl">
                <div className="flex items-center justify-between mb-4">
                    <h2 id="modal-title" className="text-lg font-semibold text-white">
                        {title}
                    </h2>
                    <button
                        onClick={onClose}
                        aria-label="Close modal"
                        className="text-gray-400 hover:text-white text-2xl leading-none"
                    >
                        ×
                    </button>
                </div>
                {children}
            </div>
        </div>
    )
}
