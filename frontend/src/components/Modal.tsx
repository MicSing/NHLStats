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
            <div className="bg-gray-800 rounded-lg w-full max-w-2xl shadow-xl flex flex-col max-h-[90vh] mx-4">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700 shrink-0">
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
                <div className="overflow-y-auto px-6 py-4 flex-1">
                    {children}
                </div>
            </div>
        </div>
    )
}
