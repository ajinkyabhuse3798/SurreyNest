/**
 * Root application component with routing, providers, and layout.
 *
 * - AuthProvider: JWT auth state
 * - CompareProvider: compare list state
 * - BrowserRouter: react-router-dom v6
 * - Lazy loading: all routes except Home and NotFound
 * - ErrorBoundary: catches render errors
 * - Footer: site-wide footer on all routes
 */
import React, { Suspense, Component } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider, RequireAuth } from './hooks/useAuth'

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
const AdminLogin = React.lazy(() => import('./pages/admin/AdminLogin'))
const AdminLayout = React.lazy(() => import('./pages/admin/AdminLayout'))
const AdminOverview = React.lazy(() => import('./pages/admin/AdminOverview'))
const AdminUsers = React.lazy(() => import('./pages/admin/AdminUsers'))
const AdminSubscriptions = React.lazy(() => import('./pages/admin/AdminSubscriptions'))
const AdminReviews = React.lazy(() => import('./pages/admin/AdminReviews'))
const AdminPipelines = React.lazy(() => import('./pages/admin/AdminPipelines'))
const CheckListing = React.lazy(() => import('./pages/CheckListing'))
const StreetSmarts = React.lazy(() => import('./pages/StreetSmarts'))
const SafetyDetail = React.lazy(() => import('./pages/SafetyDetail'))
const RentDetail = React.lazy(() => import('./pages/RentDetail'))
const AgentDirectory = React.lazy(() => import('./pages/AgentDirectory'))
const AgentDetail = React.lazy(() => import('./pages/AgentDetail'))
const RentChallengePage = React.lazy(() => import('./pages/RentChallengePage'))
const ContractChecker = React.lazy(() => import('./pages/ContractChecker'))
const Pricing = React.lazy(() => import('./pages/Pricing'))
const ForgotPassword = React.lazy(() => import('./pages/ForgotPassword'))
const ResetPassword = React.lazy(() => import('./pages/ResetPassword'))
const VerifyEmail = React.lazy(() => import('./pages/VerifyEmail'))

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
        <AuthProvider>
            <CompareProvider>
                <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
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
                                        <Route path="/best-streets" element={<StreetSmarts />} />
                                        <Route path="/safety/:postcode" element={<SafetyDetail />} />
                                        <Route path="/rent/:uprn" element={<RentDetail />} />
                                        <Route path="/login" element={<Login />} />
                                        <Route path="/register" element={<Register />} />
                                        <Route path="/forgot-password" element={<ForgotPassword />} />
                                        <Route path="/reset-password" element={<ResetPassword />} />
                                        <Route path="/verify-email" element={<VerifyEmail />} />
                                        <Route path="/rights" element={<RightsGuide />} />
                                        <Route path="/agent" element={<AgentDirectory />} />
                                        <Route path="/agent/:agentName" element={<AgentDetail />} />
                                        <Route path="/challenge-rent-increase" element={<RentChallengePage />} />
                                        <Route path="/check-contract" element={<ContractChecker />} />
                                        <Route path="/pricing" element={<Pricing />} />
                                        <Route path="/admin/login" element={<AdminLogin />} />
                                        <Route path="/admin" element={<RequireAuth adminOnly><AdminLayout /></RequireAuth>}>
                                            <Route index element={<AdminOverview />} />
                                            <Route path="dashboard" element={<AdminOverview />} />
                                            <Route path="users" element={<AdminUsers />} />
                                            <Route path="subscriptions" element={<AdminSubscriptions />} />
                                            <Route path="reviews" element={<AdminReviews />} />
                                            <Route path="pipelines" element={<AdminPipelines />} />
                                        </Route>
                                        <Route path="*" element={<NotFound />} />
                                    </Routes>
                                </div>
                            </Suspense>
                        </ErrorBoundary>
                        <Footer />
                    </div>
                </BrowserRouter>
            </CompareProvider>
        </AuthProvider>
    )
}
