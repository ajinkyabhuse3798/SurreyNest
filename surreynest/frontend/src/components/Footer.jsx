/**
 * Footer, Stitch-aligned 4-column footer with brand, links, and copyright.
 */
import { Link } from 'react-router-dom'

const PLATFORM = [
    { to: '/search', label: 'Search Listings' },
    { to: '/search', label: 'Fairness Scores' },
    { to: '/best-streets', label: 'Street Ratings' },
    { to: '/check-listing', label: 'Listing Checker' },
]

const RESOURCES = [
    { to: '/rights', label: 'Student Rights Guide' },
    { to: '/best-streets', label: 'Guildford Rent Index' },
    { to: '/about', label: 'FAQ' },
]

const COMPANY = [
    { to: '/about', label: 'About Us' },
    { to: '/about', label: 'Contact Support' },
    { to: '/about', label: 'Privacy Policy' },
    { to: '/about', label: 'Terms of Service' },
]

export default function Footer() {
    return (
        <footer className="bg-slate-50 border-t border-slate-200 py-12 md:py-16 px-4 md:px-6">
            <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12">
                {/* Brand */}
                <div className="col-span-2 md:col-span-1 flex flex-col gap-4 md:gap-6">
                    <Link to="/" className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-white shadow-lg">
                            <span className="material-symbols-outlined text-base">nest_eco_leaf</span>
                        </div>
                        <h1 className="text-lg font-bold tracking-tight text-slate-900">
                            Surrey<span className="text-primary">Nest</span>
                        </h1>
                    </Link>
                    <p className="text-sm text-slate-500 leading-relaxed">
                        The leading platform for student housing transparency in Guildford. Built for students, by students.
                    </p>
                    <div className="flex gap-4">
                        <a className="text-slate-400 hover:text-primary transition-colors" href="#">
                            <span className="material-symbols-outlined">alternate_email</span>
                        </a>
                        <a className="text-slate-400 hover:text-primary transition-colors" href="#">
                            <span className="material-symbols-outlined">public</span>
                        </a>
                    </div>
                </div>

                {/* Platform links */}
                <div>
                    <h4 className="font-bold text-slate-900 mb-4 md:mb-6">Platform</h4>
                    <ul className="flex flex-col gap-3 md:gap-4 text-sm text-slate-600 font-medium">
                        {PLATFORM.map(({ to, label }) => (
                            <li key={label}>
                                <Link className="hover:text-primary transition-colors" to={to}>{label}</Link>
                            </li>
                        ))}
                    </ul>
                </div>

                {/* Resources links */}
                <div>
                    <h4 className="font-bold text-slate-900 mb-4 md:mb-6">Resources</h4>
                    <ul className="flex flex-col gap-3 md:gap-4 text-sm text-slate-600 font-medium">
                        {RESOURCES.map(({ to, label }) => (
                            <li key={label}>
                                <Link className="hover:text-primary transition-colors" to={to}>{label}</Link>
                            </li>
                        ))}
                    </ul>
                </div>

                {/* Company links */}
                <div>
                    <h4 className="font-bold text-slate-900 mb-4 md:mb-6">Company</h4>
                    <ul className="flex flex-col gap-3 md:gap-4 text-sm text-slate-600 font-medium">
                        {COMPANY.map(({ to, label }) => (
                            <li key={label}>
                                <Link className="hover:text-primary transition-colors" to={to}>{label}</Link>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>

            {/* Copyright */}
            <div className="max-w-7xl mx-auto mt-12 md:mt-16 pt-6 md:pt-8 border-t border-slate-200 text-center">
                <p className="text-xs text-slate-400 font-medium tracking-wide">
                    © {new Date().getFullYear()} SURREYNEST. ALL RIGHTS RESERVED. POWERED BY DATA TRANSPARENCY.
                </p>
            </div>
        </footer>
    )
}
