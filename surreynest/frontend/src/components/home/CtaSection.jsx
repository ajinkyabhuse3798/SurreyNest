/**
 * CtaSection — Full-width amber CTA banner.
 * Matches Stitch CTA: "Ready to find a place you'll actually love?"
 */
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'

export default function CtaSection() {
    return (
        <section className="py-16 md:py-24 px-4 md:px-6">
            <motion.div
                className="max-w-5xl mx-auto relative rounded-[2rem] md:rounded-[3rem] overflow-hidden bg-primary px-6 md:px-8 py-16 md:py-20 text-center text-white shadow-2xl shadow-primary/40"
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 0.6 }}
            >
                {/* Abstract Pattern Background */}
                <div className="absolute inset-0 opacity-10 pointer-events-none">
                    <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 100">
                        <path d="M0 100 C 20 0 50 0 100 100 Z" fill="currentColor" />
                    </svg>
                </div>

                <div className="relative z-10 flex flex-col items-center gap-6 md:gap-8">
                    <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold max-w-2xl leading-tight">
                        Ready to find a place you'll actually love?
                    </h2>
                    <p className="text-base md:text-lg max-w-xl text-white/80">
                        Join thousands of Surrey students who trust SurreyNest for transparent housing data. No fees, no fuss.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-4">
                        <Link
                            to="/register"
                            className="bg-white text-primary px-8 md:px-10 py-3.5 md:py-4 rounded-xl font-bold shadow-xl hover:scale-105 transition-transform"
                        >
                            Create Free Account
                        </Link>
                        <Link
                            to="/search"
                            className="bg-primary/20 backdrop-blur-md border border-white/30 text-white px-8 md:px-10 py-3.5 md:py-4 rounded-xl font-bold hover:bg-primary/30 transition-all"
                        >
                            Search Properties
                        </Link>
                    </div>
                </div>
            </motion.div>
        </section>
    )
}
