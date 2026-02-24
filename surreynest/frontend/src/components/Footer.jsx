/**
 * Footer — site-wide footer with links and credits.
 */
import { Link } from 'react-router-dom'

export default function Footer() {
    return (
        <footer className="border-t border-gray-100 bg-gray-50">
            <div className="max-w-5xl mx-auto px-4 py-8 md:py-10">
                <div className="grid gap-6 md:grid-cols-3">
                    {/* Brand */}
                    <div>
                        <Link to="/" className="text-lg font-semibold">
                            <span className="text-[#0A0A0A]">Surrey</span>
                            <span className="text-indigo-600">Nest</span>
                        </Link>
                        <p className="text-xs text-gray-400 mt-2 leading-relaxed max-w-xs">
                            Helping Guildford students make informed housing decisions with
                            transparent data on rent fairness, safety and HMO licensing.
                        </p>
                    </div>

                    {/* Quick links */}
                    <div>
                        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                            Quick Links
                        </h4>
                        <ul className="space-y-2 text-sm text-gray-500">
                            <li>
                                <Link to="/search" className="hover:text-gray-900 transition-colors">
                                    Search Properties
                                </Link>
                            </li>
                            <li>
                                <Link to="/rights" className="hover:text-gray-900 transition-colors">
                                    Tenant Rights Guide
                                </Link>
                            </li>
                            <li>
                                <Link to="/about" className="hover:text-gray-900 transition-colors">
                                    About
                                </Link>
                            </li>
                        </ul>
                    </div>

                    {/* Data sources */}
                    <div>
                        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                            Data Sources
                        </h4>
                        <ul className="space-y-2 text-sm text-gray-400">
                            <li>EPC — Energy Performance Certificates</li>
                            <li>police.uk — Crime Statistics</li>
                            <li>VOA — Rental Market Statistics</li>
                        </ul>
                    </div>
                </div>

                <div className="border-t border-gray-200 mt-6 pt-4 text-center">
                    <p className="text-xs text-gray-400">
                        © {new Date().getFullYear()} SurreyNest · University of Surrey MSc Project
                    </p>
                </div>
            </div>
        </footer>
    )
}
