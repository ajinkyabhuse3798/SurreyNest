/**
 * Footer — Minimal Stitch-inspired design with link grid.
 */
import { Link } from 'react-router-dom'
import { GraduationCap } from 'lucide-react'

const LINKS = [
    { to: '/', label: 'Home' },
    { to: '/search', label: 'Search' },
    { to: '/best-streets', label: 'Best Streets' },
    { to: '/check-listing', label: 'Check Listing' },
    { to: '/rights', label: 'Rights Guide' },
    { to: '/about', label: 'About' },
]

export default function Footer() {
    return (
        <footer className="bg-slate-50 border-t border-slate-200">
            <div className="max-w-lg lg:max-w-5xl mx-auto px-6 py-8">
                {/* Logo */}
                <Link to="/" className="text-lg font-bold">
                    <span className="text-slate-900">Surrey</span>
                    <span className="text-indigo-600">Nest</span>
                </Link>

                <p className="text-xs text-slate-400 mt-2 flex items-center gap-1 font-medium">
                    <GraduationCap size={12} />
                    Built for University of Surrey students
                </p>

                {/* Link grid */}
                <div className="grid grid-cols-3 gap-y-2 gap-x-4 mt-5">
                    {LINKS.map(({ to, label }) => (
                        <Link
                            key={to}
                            to={to}
                            className="text-sm text-slate-500 hover:text-slate-900 transition-colors font-medium"
                        >
                            {label}
                        </Link>
                    ))}
                </div>

                {/* Bottom */}
                <div className="border-t border-slate-200 mt-6 pt-4 flex flex-col sm:flex-row justify-between items-center gap-2">
                    <p className="text-[11px] text-slate-400">
                        © {new Date().getFullYear()} SurreyNest
                    </p>
                    <p className="text-[11px] text-slate-400">
                        Data: EPC · Land Registry · police.uk
                    </p>
                </div>
            </div>
        </footer>
    )
}
