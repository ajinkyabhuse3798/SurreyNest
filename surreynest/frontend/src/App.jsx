/**
 * Root application component with routing.
 * Wraps everything in AuthProvider and BrowserRouter.
 */
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './hooks/useAuth'
import Home from './pages/Home'
import SearchResults from './pages/SearchResults'
import PropertyDetail from './pages/PropertyDetail'
import Login from './pages/Login'
import Register from './pages/Register'
import RightsGuide from './pages/RightsGuide'
import AdminDashboard from './pages/AdminDashboard'

export default function App() {
    return (
        <AuthProvider>
            <BrowserRouter>
                <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/search" element={<SearchResults />} />
                    <Route path="/property/:uprn" element={<PropertyDetail />} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/register" element={<Register />} />
                    <Route path="/rights" element={<RightsGuide />} />
                    <Route path="/admin" element={<AdminDashboard />} />
                </Routes>
            </BrowserRouter>
        </AuthProvider>
    )
}
