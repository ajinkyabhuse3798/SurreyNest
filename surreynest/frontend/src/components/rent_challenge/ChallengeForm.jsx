/**
 * ChallengeForm, form to submit rent increase details for analysis.
 *
 * @param {{ onSubmit: Function, loading: boolean, initialPostcode?: string, initialUprn?: string }} props
 */
import { useState } from 'react'

export default function ChallengeForm({ onSubmit, loading, initialPostcode = '', initialUprn = '' }) {
    const [postcode, setPostcode] = useState(initialPostcode)
    const [uprn] = useState(initialUprn)
    const [currentRent, setCurrentRent] = useState('')
    const [proposedRent, setProposedRent] = useState('')
    const [propertyType, setPropertyType] = useState('')
    const [bedrooms, setBedrooms] = useState('')
    const [noticeServedOn, setNoticeServedOn] = useState('')
    const [proposedEffectiveDate, setProposedEffectiveDate] = useState('')
    const [lastIncreaseEffectiveDate, setLastIncreaseEffectiveDate] = useState('')
    const [error, setError] = useState(null)

    function handleSubmit(e) {
        e.preventDefault()
        if (!postcode && !uprn) {
            setError('Please enter a postcode.')
            return
        }
        if (!currentRent || parseFloat(currentRent) <= 0) {
            setError('Please enter your current weekly rent.')
            return
        }
        if (!proposedRent || parseFloat(proposedRent) <= 0) {
            setError('Please enter the proposed weekly rent.')
            return
        }
        setError(null)
        onSubmit({
            postcode: postcode.trim().toUpperCase() || undefined,
            uprn: uprn || undefined,
            current_weekly_rent: parseFloat(currentRent),
            proposed_weekly_rent: parseFloat(proposedRent),
            property_type: propertyType || undefined,
            bedrooms: bedrooms ? parseInt(bedrooms, 10) : undefined,
            notice_served_on: noticeServedOn || undefined,
            proposed_effective_date: proposedEffectiveDate || undefined,
            last_increase_effective_date: lastIncreaseEffectiveDate || undefined,
        })
    }

    return (
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm space-y-5">
            <h2 className="text-lg font-extrabold text-slate-900">Your Rent Details</h2>
            <p className="text-sm text-slate-500">
                Add the dates from the notice if you want SurreyNest to check the new
                once-a-year and 2-month timing rules as well as the market level.
            </p>

            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
                    {error}
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-slate-600">Postcode</label>
                    <input
                        type="text"
                        value={postcode}
                        onChange={e => setPostcode(e.target.value)}
                        placeholder="e.g. GU2 7XH"
                        className="border border-slate-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-primary transition-colors"
                    />
                </div>

                <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-slate-600">Current weekly rent (£)</label>
                    <input
                        type="number"
                        value={currentRent}
                        onChange={e => setCurrentRent(e.target.value)}
                        min="1"
                        step="0.01"
                        placeholder="e.g. 200"
                        className="border border-slate-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-primary transition-colors"
                    />
                </div>

                <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-slate-600">Proposed weekly rent (£)</label>
                    <input
                        type="number"
                        value={proposedRent}
                        onChange={e => setProposedRent(e.target.value)}
                        min="1"
                        step="0.01"
                        placeholder="e.g. 230"
                        className="border border-slate-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-primary transition-colors"
                    />
                </div>

                <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-slate-600">Bedrooms (optional)</label>
                    <input
                        type="number"
                        value={bedrooms}
                        onChange={e => setBedrooms(e.target.value)}
                        min="0"
                        max="15"
                        placeholder="e.g. 3"
                        className="border border-slate-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-primary transition-colors"
                    />
                </div>

                <div className="flex flex-col gap-1.5 md:col-span-2">
                    <label className="text-xs font-semibold text-slate-600">Property type (optional)</label>
                    <select
                        value={propertyType}
                        onChange={e => setPropertyType(e.target.value)}
                        className="border border-slate-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-primary transition-colors"
                    >
                        <option value="">Select type</option>
                        <option value="Flat">Flat</option>
                        <option value="Terraced">Terraced</option>
                        <option value="Semi-Detached">Semi-Detached</option>
                        <option value="Detached">Detached</option>
                    </select>
                </div>

                <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-slate-600">Notice given on (optional)</label>
                    <input
                        type="date"
                        value={noticeServedOn}
                        onChange={e => setNoticeServedOn(e.target.value)}
                        className="border border-slate-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-primary transition-colors"
                    />
                </div>

                <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-slate-600">New rent starts on (optional)</label>
                    <input
                        type="date"
                        value={proposedEffectiveDate}
                        onChange={e => setProposedEffectiveDate(e.target.value)}
                        className="border border-slate-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-primary transition-colors"
                    />
                </div>

                <div className="flex flex-col gap-1.5 md:col-span-2">
                    <label className="text-xs font-semibold text-slate-600">Last increase took effect on (optional)</label>
                    <input
                        type="date"
                        value={lastIncreaseEffectiveDate}
                        onChange={e => setLastIncreaseEffectiveDate(e.target.value)}
                        className="border border-slate-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-primary transition-colors"
                    />
                </div>
            </div>

            <button
                type="submit"
                disabled={loading}
                className="w-full bg-primary text-white rounded-xl px-6 py-3 text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
                {loading ? 'Analysing...' : 'Analyse Rent Increase'}
            </button>
        </form>
    )
}
