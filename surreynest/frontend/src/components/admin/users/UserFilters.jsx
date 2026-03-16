/**
 * UserFilters — search input + role/pro filter pills.
 */
const ROLE_OPTIONS = [
    { value: '',         label: 'All' },
    { value: 'student',  label: 'Student' },
    { value: 'landlord', label: 'Landlord' },
    { value: 'admin',    label: 'Admin' },
]

const PRO_OPTIONS = [
    { value: '',     label: 'All' },
    { value: 'true', label: 'Pro' },
    { value: 'false', label: 'Free' },
]

function Pill({ active, onClick, children }) {
    return (
        <button
            onClick={onClick}
            className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                active
                    ? 'bg-primary text-white'
                    : 'bg-white border border-slate-200 text-slate-600 hover:border-primary/40'
            }`}
        >
            {children}
        </button>
    )
}

export default function UserFilters({ search, role, proFilter, onSearch, onRole, onPro }) {
    return (
        <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm mb-4 flex flex-wrap items-center gap-4">
            <input
                type="search"
                placeholder="Search by email…"
                value={search}
                onChange={(e) => onSearch(e.target.value)}
                className="border border-slate-200 rounded-xl px-4 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary w-56"
            />

            <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-400 mr-1">Role:</span>
                {ROLE_OPTIONS.map((o) => (
                    <Pill key={o.value} active={role === o.value} onClick={() => onRole(o.value)}>
                        {o.label}
                    </Pill>
                ))}
            </div>

            <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-400 mr-1">Plan:</span>
                {PRO_OPTIONS.map((o) => (
                    <Pill key={o.value} active={proFilter === o.value} onClick={() => onPro(o.value)}>
                        {o.label}
                    </Pill>
                ))}
            </div>
        </div>
    )
}
