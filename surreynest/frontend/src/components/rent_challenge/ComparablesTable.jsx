/**
 * ComparablesTable, responsive table of comparable properties.
 *
 * @param {{ comparables: Array }} props
 */
export default function ComparablesTable({ comparables }) {
    if (!comparables || comparables.length === 0) {
        return (
            <p className="text-sm text-slate-400 text-center py-4">
                No comparable properties found for this area.
            </p>
        )
    }

    return (
        <div className="overflow-x-auto">
            <div className="flex items-center gap-2 mb-3">
                <div className="w-3 h-3 rounded-full bg-amber-400" />
                <h3 className="text-sm font-extrabold text-amber-700 uppercase tracking-widest">
                    Market Evidence
                </h3>
            </div>
            <table className="w-full text-sm min-w-[400px]">
                <thead>
                    <tr className="border-b border-slate-100">
                        <th className="text-left text-xs font-semibold text-slate-500 pb-2">Postcode</th>
                        <th className="text-right text-xs font-semibold text-slate-500 pb-2">Weekly Rent</th>
                        <th className="text-right text-xs font-semibold text-slate-500 pb-2">Beds</th>
                        <th className="text-left text-xs font-semibold text-slate-500 pb-2 pl-4">Area</th>
                        <th className="text-left text-xs font-semibold text-slate-500 pb-2 pl-4">Source</th>
                    </tr>
                </thead>
                <tbody>
                    {comparables.map((c, i) => (
                        <tr key={i} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                            <td className="py-2.5 font-medium text-slate-800">{c.postcode}</td>
                            <td className="py-2.5 text-right font-bold text-slate-900">
                                £{c.implied_weekly_rent}/wk
                            </td>
                            <td className="py-2.5 text-right text-slate-600">
                                {c.bedrooms ?? 'N/A'}
                            </td>
                            <td className="py-2.5 pl-4 text-slate-500">{c.distance_label}</td>
                            <td className="py-2.5 pl-4 text-slate-400 text-xs">{c.source}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}
