/**
 * CtaSection — Dark indigo gradient CTA footer with radial glow.
 */
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'

export default function CtaSection() {
    return (
        <section className="relative overflow-hidden bg-gradient-to-br from-indigo-900 via-indigo-800 to-purple-900 px-4 py-16 md:py-20 lg:py-24">
            {/* Radial glow */}
            <div className="absolute inset-0 opacity-30">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-indigo-500 rounded-full blur-[120px]" />
            </div>

            <div className="relative z-10 max-w-lg lg:max-w-3xl mx-auto text-center">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                >
                    <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold text-white mb-3 leading-tight">
                        Ready to find your perfect student home?
                    </h2>
                    <p className="text-indigo-200 text-sm md:text-base lg:text-lg font-medium mb-8 max-w-md lg:max-w-xl mx-auto">
                        Join thousands of Surrey students making smarter rental choices with real data.
                    </p>

                    <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                        <Link
                            to="/search"
                            className="w-full sm:w-auto px-8 lg:px-10 py-3.5 lg:py-4 bg-white text-indigo-700 font-bold text-sm lg:text-base rounded-xl hover:bg-indigo-50 transition-colors shadow-lg shadow-white/10 flex items-center justify-center gap-2"
                        >
                            Search Now
                            <ArrowRight size={16} />
                        </Link>
                        <Link
                            to="/about"
                            className="w-full sm:w-auto px-8 lg:px-10 py-3.5 lg:py-4 border border-indigo-400/40 text-indigo-100 font-bold text-sm lg:text-base rounded-xl hover:border-indigo-300 hover:text-white transition-colors"
                        >
                            Learn More
                        </Link>
                    </div>

                    <p className="text-[11px] lg:text-xs text-indigo-300/60 mt-8 font-medium">
                        100% free · No sign-up required · Updated daily
                    </p>
                </motion.div>
            </div>
        </section>
    )
}
