/**
 * 404 Not Found page, catch-all for unknown routes.
 */
import { Link } from 'react-router-dom'
import Navbar from '../components/Navbar'

export default function NotFound() {
    return (
        <main className="min-h-screen bg-white">
            <Navbar />

            <section className="max-w-md mx-auto px-4 py-20 text-center">
                <p className="text-6xl font-bold text-primary mb-4">404</p>
                <h1 className="text-xl font-semibold text-[#0A0A0A] mb-2">
                    Page not found
                </h1>
                <p className="text-sm text-gray-500 mb-8">
                    The page you're looking for doesn't exist or has been moved.
                </p>
                <Link
                    to="/"
                    className="inline-block bg-primary text-white text-sm px-5 py-2.5 rounded-lg hover:bg-primary/90 transition-colors"
                >
                    Back to Home
                </Link>
            </section>
        </main>
    )
}
