import { useMemo, useState } from 'react'

const DEFAULT_PAGE_SIZE = 20

interface UseTableOptions<T> {
    data: T[]
    /** Fields to search in (extracts strings from each item) */
    searchFields: (item: T) => string[]
    pageSize?: number
}

interface UseTableResult<T> {
    /** Items for the current page, filtered by search */
    pageItems: T[]
    /** Total filtered items count (for pagination) */
    totalFiltered: number
    /** Search query */
    search: string
    setSearch: (v: string) => void
    /** Current 1-based page */
    currentPage: number
    setCurrentPage: (page: number) => void
    /** Items per page */
    pageSize: number
}

export default function useTable<T>({
    data,
    searchFields,
    pageSize = DEFAULT_PAGE_SIZE,
}: UseTableOptions<T>): UseTableResult<T> {
    const [search, setSearchRaw] = useState('')
    const [currentPage, setCurrentPage] = useState(1)

    // Reset to page 1 when search changes
    const setSearch = (v: string) => {
        setSearchRaw(v)
        setCurrentPage(1)
    }

    const filtered = useMemo(() => {
        if (!search.trim()) return data
        const q = search.toLowerCase()
        return data.filter((item) =>
            searchFields(item).some((field) => field.toLowerCase().includes(q)),
        )
    }, [data, search, searchFields])

    const pageItems = useMemo(() => {
        const start = (currentPage - 1) * pageSize
        return filtered.slice(start, start + pageSize)
    }, [filtered, currentPage, pageSize])

    return {
        pageItems,
        totalFiltered: filtered.length,
        search,
        setSearch,
        currentPage,
        setCurrentPage,
        pageSize,
    }
}
