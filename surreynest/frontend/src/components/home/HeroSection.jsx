/**
 * HeroSection — Stitch-aligned hero with search bar, student avatars, and hero image card.
 * Receives search state + handler from Home page.
 */
import { motion } from 'framer-motion'

const fadeUp = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }

export default function HeroSection({ postcode, setPostcode, radius, setRadius, error, loading, handleSearch }) {
    return (
        <section className="flex-1 max-w-7xl mx-auto px-4 md:px-6 pt-8 md:pt-12 pb-16 md:pb-24 grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
            {/* Left — Copy + Search */}
            <motion.div
                className="flex flex-col gap-6 md:gap-8"
                initial="hidden"
                animate="visible"
                variants={{ visible: { transition: { staggerChildren: 0.1 } } }}
            >
                {/* Live badge */}
                <motion.div variants={fadeUp} className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 w-fit">
                    <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
                    </span>
                    <span className="text-xs font-bold uppercase tracking-wider text-primary">Live in Guildford</span>
                </motion.div>

                {/* Headline */}
                <motion.h1 variants={fadeUp} className="text-4xl sm:text-5xl md:text-7xl font-bold leading-[1.1] text-slate-900">
                    Empowering <br />
                    <span className="text-primary">Guildford</span> Students
                </motion.h1>

                {/* Subtext */}
                <motion.p variants={fadeUp} className="text-base md:text-lg text-slate-600 max-w-lg leading-relaxed">
                    Navigate the student housing market with confidence. Use our ML-powered tools to verify rent fairness, HMO compliance, and tenant rights in seconds.
                </motion.p>

                {/* Search Bar */}
                <motion.div variants={fadeUp} className="relative max-w-xl group">
                    <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 to-primary/5 rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200" />
                    <div className="relative glass rounded-xl p-2 flex flex-col sm:flex-row items-stretch sm:items-center shadow-xl border-white/50">
                        <div className="flex-1 flex items-center px-3 md:px-4 gap-3">
                            <span className="material-symbols-outlined text-primary/60">location_on</span>
                            <input
                                className="w-full bg-transparent border-none focus:ring-0 focus:outline-none text-slate-900 placeholder:text-slate-400 font-medium py-3 text-sm md:text-base"
                                placeholder="Enter Postcode (e.g. GU2 7XH)"
                                type="text"
                                value={postcode}
                                onChange={(e) => setPostcode(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                            />
                        </div>
                        <button
                            onClick={() => handleSearch()}
                            disabled={loading}
                            className="bg-primary text-white px-6 md:px-8 py-3 rounded-lg font-bold flex items-center justify-center gap-2 hover:shadow-xl hover:shadow-primary/30 transition-all active:scale-95 text-sm md:text-base mt-2 sm:mt-0"
                        >
                            {loading ? (
                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            ) : (
                                <>
                                    Search Now
                                    <span className="material-symbols-outlined text-sm">arrow_forward</span>
                                </>
                            )}
                        </button>
                    </div>
                    {error && <p className="text-sm text-red-500 font-medium mt-2 px-2">{error}</p>}
                </motion.div>

                {/* Student avatars + trust text */}
                <motion.div variants={fadeUp} className="flex items-center gap-4 md:gap-6 pt-2 md:pt-4">
                    <div className="flex -space-x-3">
                        {[
                            'https://lh3.googleusercontent.com/aida-public/AB6AXuDRF6nzIwyNYZnkjj7DI5dftFWTJjDUcRq_v9jbS-F5ibAs2WaRa3ODlxFvL2NRTftSaSIUDCVCSrY_y1AbEHXfx9GaWO79A2TtyQ6nPx5b1QKnBLZRxf8tJbg8xPID-8j3-ytlLxts75yOTvNXlBwDaUPfJ7WA57zBrYh2G5FhxjfkP_9xxkKuhlLpgLLKqfw-MfzB0CmP1zWDMUgst5rcFhIiXHbNgwPKv0qarOOCwaDTykaIsE7_RQ4nDIqHVj1lRinl6t1uhc8',
                            'https://lh3.googleusercontent.com/aida-public/AB6AXuBymYnGhMS1HJg-N2Mt_DRIwkDDxt4-zmSqRAtI8NLIOkz0vVqKCwUjzpZDRmGIm1TE_QHpRyiU95rctcllW_nuf6CHZiaAUi_v1wgAiRD28QL3_vBcPguyEZWnt-n1fengGZK8pFoketUBXDLeCNCDTVDOasvU1tsLt0daF9E9qpXO0DKCppfKuiyA9fKq_vJv8Nqj54uOnmDYTzPu1ZNpTAOxbjdyLLs_iwVDTnjVBNs4zqN8opAz2PbkJBlWALCstOKwkZ9FIMQ',
                            'https://lh3.googleusercontent.com/aida-public/AB6AXuC2-MhnH_JrKL6YgJP4RHvAzyeVJJ9aUxLdERdQ3x0aR4MQP4BNt-qCZhG3ERcFx8rkFpTg3KWcUGBkbwZYXXm3DIGEym1ErscAMGdoHG6encb8xoKUDGKeXoyM1oZXsQLBBLF1oodGAh0jMp_QGJWcsp9hPP_F8vQeHyy7BgKU4ah5G3TAVa2kSKl7MqU0MCrepWuP2IrIEZoVjK6cr4tgox4_Em4iEYZCfnNDEx46owK2vCDvzlgmhTLGaAPTaLXk6OOrnysCSOk',
                        ].map((src, i) => (
                            <img key={i} className="h-9 w-9 md:h-10 md:w-10 rounded-full border-2 border-white object-cover" src={src} alt="Student" />
                        ))}
                    </div>
                    <p className="text-sm text-slate-500 font-medium">
                        Joined by <span className="text-slate-900 font-bold">2,500+</span> Surrey students this month
                    </p>
                </motion.div>
            </motion.div>

            {/* Right — Hero image card (desktop) */}
            <motion.div
                className="relative hidden lg:block"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.6, delay: 0.3 }}
            >
                <div className="relative glass p-4 rounded-3xl shadow-2xl border-white/40 overflow-hidden group">
                    <img
                        className="rounded-2xl w-full h-[500px] object-cover transition-transform duration-700 group-hover:scale-105"
                        src="https://lh3.googleusercontent.com/aida-public/AB6AXuDCjFjq0xvCyTOAFMDH4rABIUY2cpPEB3UNcMeSENiKNWMgSpnPBetEymO0vj2TRaqNsNLwSlGD6VJzoSFRUJjKPFOvtvNy7zx4TRGCgKE4HALh4XVeru7AjDYG9j02s3e9Rw_upVqRWDJ-MXZSgtgy_Tm3no4NKfU8exSHTnSb0wz1zZ1Rv1ENKEWnsLaCiGxHXnjqnrR1SW_R29POaEcqZNC9y3dQwIRKb2bpXYS0-MZJoRkm2RcS6b5PNYHxzb9hR-cEnPFVPLg"
                        alt="Students studying together"
                    />
                    <div className="absolute bottom-10 left-10 right-10 glass p-5 md:p-6 rounded-2xl shadow-xl">
                        <div className="flex items-center justify-between mb-4">
                            <span className="text-xs font-bold text-primary uppercase">Market Trend</span>
                            <span className="text-xs font-bold text-green-600 bg-green-100 px-2 py-0.5 rounded">+12% Fairness</span>
                        </div>
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-primary w-[75%] rounded-full" />
                        </div>
                        <p className="mt-4 text-sm font-medium text-slate-700">
                            Guildford housing quality is improving. Check your property status now.
                        </p>
                    </div>
                </div>
            </motion.div>
        </section>
    )
}
