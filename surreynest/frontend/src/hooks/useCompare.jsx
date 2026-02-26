/**
 * useCompare — Context for managing property comparison list.
 *
 * Stores up to 4 UPRNs. Persisted to sessionStorage so state
 * survives page refreshes. Syncs to URL params on compare page.
 *
 * Usage:
 *   const { compareList, addToCompare, removeFromCompare, clearCompare, isInCompare } = useCompare()
 */
import { createContext, useContext, useState, useCallback } from 'react'

const STORAGE_KEY = 'surreynest_compare'
const MAX_COMPARE = 4

function loadFromStorage() {
    try {
        const raw = sessionStorage.getItem(STORAGE_KEY)
        return raw ? JSON.parse(raw) : []
    } catch {
        return []
    }
}

function saveToStorage(list) {
    try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(list))
    } catch {
        // silently fail if sessionStorage unavailable
    }
}

const CompareContext = createContext(null)

export function CompareProvider({ children }) {
    const [compareList, setCompareList] = useState(loadFromStorage)

    const addToCompare = useCallback((uprn) => {
        setCompareList((prev) => {
            if (prev.length >= MAX_COMPARE || prev.includes(uprn)) return prev
            const next = [...prev, uprn]
            saveToStorage(next)
            return next
        })
    }, [])

    const removeFromCompare = useCallback((uprn) => {
        setCompareList((prev) => {
            const next = prev.filter((u) => u !== uprn)
            saveToStorage(next)
            return next
        })
    }, [])

    const clearCompare = useCallback(() => {
        setCompareList([])
        saveToStorage([])
    }, [])

    const isInCompare = useCallback(
        (uprn) => compareList.includes(uprn),
        [compareList]
    )

    return (
        <CompareContext.Provider value={{ compareList, addToCompare, removeFromCompare, clearCompare, isInCompare }}>
            {children}
        </CompareContext.Provider>
    )
}

export function useCompare() {
    const ctx = useContext(CompareContext)
    if (!ctx) throw new Error('useCompare must be used within CompareProvider')
    return ctx
}
