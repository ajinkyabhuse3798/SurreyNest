/**
 * Root application component with public-site routing, providers, and layout.
 *
 * - CompareProvider: compare list state
 * - BrowserRouter: react-router-dom v6
 * - Lazy loading: all routes except Home and NotFound
 * - ErrorBoundary: catches render errors
 * - Footer: site-wide footer on all routes
 */
import React, { Suspense, Component } from 'react'
import { BrowserRouter, Routes, Route, useLocation, Navigate } from 'react-router-dom'
import { CompareProvider } from './hooks/useCompare'
import Home from './pages/Home'
import NotFound from './pages/NotFound'
import Footer from './components/Footer'
import ClarityAnalytics from './components/ClarityAnalytics'

// ── Lazy-loaded routes (code splitting) ──────────────────────────────────────
const SearchResults = React.lazy(() => import('./pages/SearchResults'))
const PropertyDetail = React.lazy(() => import('./pages/PropertyDetail'))
const CompareProperties = React.lazy(() => import('./pages/CompareProperties'))
const About = React.lazy(() => import('./pages/About'))
const RightsGuide = React.lazy(() => import('./pages/RightsGuide'))
const CheckListing = React.lazy(() => import('./pages/CheckListing'))
const SafetyOverview = React.lazy(() => import('./pages/SafetyOverview'))
const SafetyDetail = React.lazy(() => import('./pages/SafetyDetail'))
const RentDetail = React.lazy(() => import('./pages/RentDetail'))
const AgentDirectory = React.lazy(() => import('./pages/AgentDirectory'))
const AgentDetail = React.lazy(() => import('./pages/AgentDetail'))
const RentChallengePage = React.lazy(() => import('./pages/RentChallengePage'))

const LEGACY_REDIRECT_PATHS = [
    '/login',
    '/register',
    '/forgot-password',
    '/reset-password',
    '/verify-email',
    '/admin/*',
]

// ── Route-level loading spinner ──────────────────────────────────────────────
function RouteLoader() {
    return (
        <div className="min-h-[60vh] flex items-center justify-center">
            <div className="text-center">
                <div className="inline-block w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-gray-400 mt-3">Loading…</p>
            </div>
        </div>
    )
}

function ScrollToTop() {
    const location = useLocation()

    React.useLayoutEffect(() => {
        if (location.hash) return
        window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
    }, [location.pathname, location.search, location.hash])

    return null
}

// ── Error boundary ───────────────────────────────────────────────────────────
class ErrorBoundary extends Component {
    constructor(props) {
        super(props)
        this.state = { hasError: false, error: null }
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error }
    }

    componentDidCatch(error, errorInfo) {
        console.error('ErrorBoundary caught:', error, errorInfo)
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-[60vh] flex items-center justify-center px-4">
                    <div className="text-center max-w-md">
                        <p className="text-4xl font-bold text-red-500 mb-3">Oops</p>
                        <h2 className="text-lg font-semibold text-[#0A0A0A] mb-2">
                            Something went wrong
                        </h2>
                        <p className="text-sm text-gray-500 mb-6">
                            We hit an unexpected issue. Please try refreshing the page.
                        </p>
                        <button
                            onClick={() => {
                                this.setState({ hasError: false, error: null })
                                window.location.href = '/'
                            }}
                            className="bg-primary text-white text-sm px-5 py-2.5 rounded-lg hover:opacity-90 transition-all"
                        >
                            Back to Home
                        </button>
                    </div>
                </div>
            )
        }

        return this.props.children
    }
}

// ── App ──────────────────────────────────────────────────────────────────────
export default function App() {
    return (
        <CompareProvider>
            <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                <ScrollToTop />
                <ClarityAnalytics />
                <div className="flex flex-col min-h-screen">
                    <ErrorBoundary>
                        <Suspense fallback={<RouteLoader />}>
                            <div className="flex-1">
                                <Routes>
                                    <Route path="/" element={<Home />} />
                                    <Route path="/search" element={<SearchResults />} />
                                    <Route path="/property/:uprn" element={<PropertyDetail />} />
                                    <Route path="/compare" element={<CompareProperties />} />
                                    <Route path="/about" element={<About />} />
                                    <Route path="/check-listing" element={<CheckListing />} />
                                    <Route path="/best-streets" element={<Navigate to="/safety" replace />} />
                                    <Route path="/safety" element={<SafetyOverview />} />
                                    <Route path="/safety/:postcode" element={<SafetyDetail />} />
                                    <Route path="/rent/:uprn" element={<RentDetail />} />
                                    <Route path="/rights" element={<RightsGuide />} />
                                    <Route path="/agent" element={<AgentDirectory />} />
                                    <Route path="/agent/:agentName" element={<AgentDetail />} />
                                    <Route path="/challenge-rent-increase" element={<RentChallengePage />} />
                                    <Route path="/check-contract" element={<Navigate to="/rights" replace />} />
                                    {LEGACY_REDIRECT_PATHS.map((path) => (
                                        <Route key={path} path={path} element={<Navigate to="/" replace />} />
                                    ))}
                                    <Route path="*" element={<NotFound />} />
                                </Routes>
                            </div>
                        </Suspense>
                    </ErrorBoundary>
                    <Footer />
                </div>
            </BrowserRouter>
        </CompareProvider>
    )
}
