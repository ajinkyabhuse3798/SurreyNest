/**
 * CompareBar, Floating compare bar.
 */
import { useNavigate } from 'react-router-dom'
import { ArrowLeftRight, ArrowRight } from 'lucide-react'

export default function CompareBar({ compareList, clearCompare }) {
    const navigate = useNavigate()

    if (compareList.length === 0) return null

    return (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-lg border-t border-slate-200 shadow-[0_-4px_24px_-4px_rgba(0,0,0,0.1)] px-4 py-3">
            <div className="max-w-7xl mx-auto flex items-center justify-between">
                <div className="flex items-center gap-2.5 text-sm text-slate-700 font-medium">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <ArrowLeftRight size={14} className="text-primary" />
                    </div>
                    <span>
                        <span className="font-extrabold text-slate-900">{compareList.length}</span>{' '}
                        propert{compareList.length === 1 ? 'y' : 'ies'} selected
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => clearCompare()}
                        className="text-xs text-slate-400 hover:text-rose-500 font-semibold px-3 py-2 transition-colors"
                    >
                        Clear selection
                    </button>
                    <button
                        onClick={() => navigate(`/compare?uprns=${compareList.join(',')}`)}
                        disabled={compareList.length < 2}
                        className="bg-primary text-white text-sm font-bold px-5 py-2.5 rounded-xl hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg shadow-primary-600/20 flex items-center gap-1.5"
                    >
                        Compare Now
                        <ArrowRight size={14} />
                    </button>
                </div>
            </div>
        </div>
    )
}
