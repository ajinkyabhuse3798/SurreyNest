/**
 * Search context, persists search params and results across route navigation.
 *
 * Usage:
 *   Wrap app in <SearchProvider>, then call useSearch() in any component.
 *   { postcode, radius, results, loading, setPostcode, setRadius, setResults, setLoading, clearSearch }
 */
import { createContext, useContext, useState, useCallback } from 'react'

const SearchContext = createContext(null)

export function SearchProvider({ children }) {
    const [postcode, setPostcode] = useState('')
    const [radius, setRadius] = useState(1000)
    const [results, setResults] = useState([])
    const [loading, setLoading] = useState(false)

    const clearSearch = useCallback(() => {
        setPostcode('')
        setRadius(1000)
        setResults([])
        setLoading(false)
    }, [])

    const value = {
        postcode, setPostcode,
        radius, setRadius,
        results, setResults,
        loading, setLoading,
        clearSearch,
    }

    return <SearchContext.Provider value={value}>{children}</SearchContext.Provider>
}

export function useSearch() {
    const context = useContext(SearchContext)
    if (!context) {
        throw new Error('useSearch must be used within a SearchProvider')
    }
    return context
}
