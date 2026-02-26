/**
 * Root application component with routing, providers, and layout.
 *
 * - AuthProvider: JWT auth state
 * - SearchProvider: search params + results cache
 * - BrowserRouter: react-router-dom v6
 * - Lazy loading: all routes except Home and NotFound
 * - ErrorBoundary: catches render errors
 * - Footer: site-wide footer on all routes
 */
import React, { Suspense, Component } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './hooks/useAuth'
import { SearchProvider } from './hooks/useSearch'
import { CompareProvider } from './hooks/useCompare'
import Home from './pages/Home'
import NotFound from './pages/NotFound'
import Footer from './components/Footer'

// ── Lazy-loaded routes (code splitting) ──────────────────────────────────────
const SearchResults = React.lazy(() => import('./pages/SearchResults'))
const PropertyDetail = React.lazy(() => import('./pages/PropertyDetail'))
const CompareProperties = React.lazy(() => import('./pages/CompareProperties'))
const About = React.lazy(() => import('./pages/About'))
const Login = React.lazy(() => import('./pages/Login'))
const Register = React.lazy(() => import('./pages/Register'))
const RightsGuide = React.lazy(() => import('./pages/RightsGuide'))
const AdminDashboard = React.lazy(() => import('./pages/AdminDashboard'))

// ── Route-level loading spinner ──────────────────────────────────────────────
function RouteLoader() {
    return (
        <div className="min-h-[60vh] flex items-center justify-center">
            <div className="text-center">
                <div className="inline-block w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-gray-400 mt-3">Loading…</p>
            </div>
        </div>
    )
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
                            {this.state.error?.message || 'An unexpected error occurred.'}
                        </p>
                        <button
                            onClick={() => {
                                this.setState({ hasError: false, error: null })
                                window.location.href = '/'
                            }}
                            className="bg-indigo-600 text-white text-sm px-5 py-2.5 rounded-lg hover:bg-indigo-700 transition-colors"
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
        <AuthProvider>
            <SearchProvider>
                <CompareProvider>
                    <BrowserRouter>
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
                                            <Route path="/login" element={<Login />} />
                                            <Route path="/register" element={<Register />} />
                                            <Route path="/rights" element={<RightsGuide />} />
                                            <Route path="/admin" element={<AdminDashboard />} />
                                            <Route path="*" element={<NotFound />} />
                                        </Routes>
                                    </div>
                                </Suspense>
                            </ErrorBoundary>
                            <Footer />
                        </div>
                    </BrowserRouter>
                </CompareProvider>
            </SearchProvider>
        </AuthProvider>
    )
}
