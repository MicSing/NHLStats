import { useTranslation } from 'react-i18next'

interface PaginationProps {
    currentPage: number
    totalItems: number
    pageSize: number
    onPageChange: (page: number) => void
}

export default function Pagination({
    currentPage,
    totalItems,
    pageSize,
    onPageChange,
}: PaginationProps) {
    const { t } = useTranslation()
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))

    if (totalPages <= 1) return null

    const from = (currentPage - 1) * pageSize + 1
    const to = Math.min(currentPage * pageSize, totalItems)

    // Build page numbers to display (max 7 visible)
    const pages: (number | '...')[] = []
    if (totalPages <= 7) {
        for (let i = 1; i <= totalPages; i++) pages.push(i)
    } else {
        pages.push(1)
        if (currentPage > 3) pages.push('...')
        const start = Math.max(2, currentPage - 1)
        const end = Math.min(totalPages - 1, currentPage + 1)
        for (let i = start; i <= end; i++) pages.push(i)
        if (currentPage < totalPages - 2) pages.push('...')
        pages.push(totalPages)
    }

    return (
        <div className="flex items-center justify-between mt-4 text-sm flex-wrap gap-2">
            <span className="text-text-muted text-xs">
                {t('pagination.showing', { from, to, total: totalItems })}
            </span>
            <div className="flex items-center gap-1">
                <button
                    onClick={() => onPageChange(currentPage - 1)}
                    disabled={currentPage <= 1}
                    className="px-2 py-1 rounded text-text-muted hover:text-text hover:bg-border disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    aria-label={t('pagination.previous')}
                >
                    ‹
                </button>
                {pages.map((page, i) =>
                    page === '...' ? (
                        <span key={`ellipsis-${i}`} className="px-1 text-text-muted">
                            …
                        </span>
                    ) : (
                        <button
                            key={page}
                            onClick={() => onPageChange(page)}
                            className={`min-w-[2rem] px-2 py-1 rounded text-center transition-colors ${page === currentPage
                                    ? 'bg-primary text-white font-semibold'
                                    : 'text-text-muted hover:text-text hover:bg-border'
                                }`}
                        >
                            {page}
                        </button>
                    ),
                )}
                <button
                    onClick={() => onPageChange(currentPage + 1)}
                    disabled={currentPage >= totalPages}
                    className="px-2 py-1 rounded text-text-muted hover:text-text hover:bg-border disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    aria-label={t('pagination.next')}
                >
                    ›
                </button>
            </div>
        </div>
    )
}
