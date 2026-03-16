/**
 * UsersTab — user management with search, filters, and inline editing.
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import { getUsers } from '../../../services/adminApi'
import UserFilters from './UserFilters'
import UserTable from './UserTable'

export default function UsersTab() {
    const [users, setUsers] = useState([])
    const [total, setTotal] = useState(0)
    const [page, setPage] = useState(1)
    const [pages, setPages] = useState(1)
    const [search, setSearch] = useState('')
    const [role, setRole] = useState('')
    const [proFilter, setProFilter] = useState('')
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    const debounceRef = useRef(null)

    const load = useCallback((p, s, r, pro) => {
        setLoading(true)
        setError(null)
        const params = { page: p, per_page: 20 }
        if (s) params.search = s
        if (r) params.role = r
        if (pro !== '') params.is_pro = pro === 'true'
        getUsers(params)
            .then((data) => {
                setUsers(data.users || [])
                setTotal(data.total || 0)
                setPages(data.pages || 1)
            })
            .catch((e) => setError(e.message))
            .finally(() => setLoading(false))
    }, [])

    // Re-fetch whenever filters change (with debounce for search)
    useEffect(() => {
        clearTimeout(debounceRef.current)
        debounceRef.current = setTimeout(() => {
            setPage(1)
            load(1, search, role, proFilter)
        }, 300)
        return () => clearTimeout(debounceRef.current)
    }, [search, role, proFilter, load])

    // Re-fetch when page changes
    useEffect(() => {
        load(page, search, role, proFilter)
    }, [page]) // eslint-disable-line react-hooks/exhaustive-deps

    function handleUpdated(updatedUser) {
        setUsers((prev) => prev.map((u) => (u.id === updatedUser.id ? updatedUser : u)))
    }

    return (
        <div>
            <UserFilters
                search={search}
                role={role}
                proFilter={proFilter}
                onSearch={setSearch}
                onRole={setRole}
                onPro={setProFilter}
            />

            {loading && (
                <div className="space-y-2">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="animate-pulse bg-slate-100 rounded-xl h-12" />
                    ))}
                </div>
            )}

            {error && (
                <div className="bg-rose-50 border border-rose-200 rounded-xl px-4 py-3 text-sm text-rose-700">
                    {error}
                </div>
            )}

            {!loading && !error && (
                <UserTable
                    users={users}
                    total={total}
                    page={page}
                    pages={pages}
                    onPage={setPage}
                    onUpdated={handleUpdated}
                />
            )}
        </div>
    )
}
