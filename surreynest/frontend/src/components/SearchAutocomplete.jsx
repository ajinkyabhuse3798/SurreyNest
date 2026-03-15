/**
 * SearchAutocomplete — typeahead property search with dropdown suggestions.
 *
 * Fires on every keystroke (debounced 300ms) and shows matching properties
 * from the suggest endpoint. Clicking a suggestion navigates to the property
 * detail page. If Enter is pressed or no suggestion is clicked, falls through
 * to postcode search (existing behaviour).
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, MapPin, X } from 'lucide-react'
import api from '../services/api'

export default function SearchAutocomplete({
    onPostcodeSearch,
    defaultValue = '',
    placeholder = 'Search by postcode or address...',
    className = '',
}) {
    const [query, setQuery] = useState(defaultValue)
    const [suggestions, setSuggestions] = useState([])
    const [showDropdown, setShowDropdown] = useState(false)
    const [activeIndex, setActiveIndex] = useState(-1)
    const [loading, setLoading] = useState(false)
    const navigate = useNavigate()
    const wrapperRef = useRef(null)
    const debounceRef = useRef(null)

    // ── Fetch suggestions (debounced) ──────────────────────────────────
    const fetchSuggestions = useCallback(async (q) => {
        if (!q || q.length < 2) {
            setSuggestions([])
            setShowDropdown(false)
            return
        }

        setLoading(true)
        try {
            const res = await api.get('/api/properties/suggest', {
                params: { q, limit: 8 },
            })
            setSuggestions(res.data || [])
            setShowDropdown(res.data?.length > 0)
        } catch {
            setSuggestions([])
            setShowDropdown(false)
        } finally {
            setLoading(false)
        }
    }, [])

    // ── Debounce handler ──────────────────────────────────────────────
    useEffect(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current)
        debounceRef.current = setTimeout(() => fetchSuggestions(query), 300)
        return () => clearTimeout(debounceRef.current)
    }, [query, fetchSuggestions])

    // ── Click outside to close ────────────────────────────────────────
    useEffect(() => {
        function handleClickOutside(e) {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
                setShowDropdown(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    // ── Keyboard navigation ──────────────────────────────────────────
    const handleKeyDown = (e) => {
        if (!showDropdown) {
            if (e.key === 'Enter') {
                e.preventDefault()
                onPostcodeSearch?.(query)
            }
            return
        }

        if (e.key === 'ArrowDown') {
            e.preventDefault()
            setActiveIndex((prev) => Math.min(prev + 1, suggestions.length - 1))
        } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setActiveIndex((prev) => Math.max(prev - 1, -1))
        } else if (e.key === 'Enter') {
            e.preventDefault()
            if (activeIndex >= 0 && suggestions[activeIndex]) {
                navigate(`/property/${suggestions[activeIndex].uprn}`)
                setShowDropdown(false)
            } else {
                onPostcodeSearch?.(query)
                setShowDropdown(false)
            }
        } else if (e.key === 'Escape') {
            setShowDropdown(false)
        }
    }

    return (
        <div ref={wrapperRef} className={`relative ${className}`}>
            <div className="relative">
                <Search
                    size={18}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                />
                <input
                    type="text"
                    value={query}
                    onChange={(e) => {
                        setQuery(e.target.value)
                        setActiveIndex(-1)
                    }}
                    onKeyDown={handleKeyDown}
                    onFocus={() => suggestions.length > 0 && setShowDropdown(true)}
                    placeholder={placeholder}
                    className="w-full pl-10 pr-10 py-3 rounded-xl border border-gray-200 bg-white text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-shadow shadow-sm"
                    autoComplete="off"
                    id="search-autocomplete"
                />
                {query && (
                    <button
                        onClick={() => {
                            setQuery('')
                            setSuggestions([])
                            setShowDropdown(false)
                        }}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                        <X size={16} />
                    </button>
                )}
            </div>

            {/* ── Dropdown ──────────────────────────────────────────────── */}
            {showDropdown && (
                <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden max-h-80 overflow-y-auto">
                    {suggestions.map((s, i) => (
                        <button
                            key={s.uprn}
                            onMouseDown={(e) => {
                                e.preventDefault()
                                navigate(`/property/${s.uprn}`)
                                setShowDropdown(false)
                            }}
                            onMouseEnter={() => setActiveIndex(i)}
                            className={`w-full text-left px-4 py-3 flex items-start gap-3 text-sm transition-colors ${i === activeIndex
                                    ? 'bg-primary/10 text-primary-900'
                                    : 'text-gray-700 hover:bg-gray-50'
                                }`}
                        >
                            <MapPin
                                size={14}
                                className={`mt-0.5 flex-shrink-0 ${i === activeIndex ? 'text-primary/80' : 'text-gray-400'
                                    }`}
                            />
                            <div className="min-w-0">
                                <p className="font-medium truncate">{s.address}</p>
                                <p className="text-xs text-gray-400">{s.postcode}</p>
                            </div>
                        </button>
                    ))}
                    {loading && (
                        <div className="px-4 py-3 text-xs text-gray-400 text-center">
                            Searching...
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
