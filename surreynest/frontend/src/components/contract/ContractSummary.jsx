/**
 * ContractSummary — pill counts for danger/caution/safe clauses.
 *
 * @param {{ clauses: Array }} props
 */
export default function ContractSummary({ clauses }) {
    const danger = clauses.filter(c => c.risk_level === 'danger').length
    const caution = clauses.filter(c => c.risk_level === 'caution').length
    const safe = clauses.filter(c => c.risk_level === 'safe').length

    return (
        <div className="flex flex-wrap gap-3">
            <span className="flex items-center gap-2 bg-rose-100 text-rose-700 border border-rose-200 rounded-full px-4 py-2 text-sm font-semibold">
                <span className="w-5 h-5 bg-rose-500 text-white rounded-full text-xs flex items-center justify-center font-bold">
                    {danger}
                </span>
                Danger
            </span>
            <span className="flex items-center gap-2 bg-amber-100 text-amber-700 border border-amber-200 rounded-full px-4 py-2 text-sm font-semibold">
                <span className="w-5 h-5 bg-amber-500 text-white rounded-full text-xs flex items-center justify-center font-bold">
                    {caution}
                </span>
                Caution
            </span>
            <span className="flex items-center gap-2 bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-full px-4 py-2 text-sm font-semibold">
                <span className="w-5 h-5 bg-emerald-500 text-white rounded-full text-xs flex items-center justify-center font-bold">
                    {safe}
                </span>
                Safe
            </span>
        </div>
    )
}
