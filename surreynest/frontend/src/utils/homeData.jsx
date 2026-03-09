/**
 * Shared data, animation variants, and AnimatedSection for the Home page.
 */
import { useRef } from 'react'
import { motion, useInView } from 'framer-motion'
import {
    Search, BarChart3, Shield, Home as HomeIcon, CheckCircle2,
    Zap, Database, Star, Clock, PoundSterling, Brain,
} from 'lucide-react'

// ── Animation variants ──────────────────────────────────────────────────────

export const fadeUp = {
    hidden: { opacity: 0, y: 24 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } },
}

export const scaleIn = {
    hidden: { opacity: 0, scale: 0.92 },
    visible: { opacity: 1, scale: 1, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
}

export const staggerContainer = {
    hidden: {},
    visible: { transition: { staggerChildren: 0.12 } },
}

export function AnimatedSection({ children, className = '' }) {
    const ref = useRef(null)
    const inView = useInView(ref, { once: true, margin: '-40px' })
    return (
        <motion.div
            ref={ref}
            initial="hidden"
            animate={inView ? 'visible' : 'hidden'}
            variants={staggerContainer}
            className={className}
        >
            {children}
        </motion.div>
    )
}

// ── Data ────────────────────────────────────────────────────────────────────

export const POSTCODE_RE = /^[A-Z]{1,2}\d[0-9A-Z]?\s*\d[A-Z]{2}$/i

export const FEATURES = [
    {
        icon: Shield,
        title: 'Safety Intelligence',
        desc: 'Crime breakdown, trend analysis, student vulnerability index, and holiday burglary risk — powered by police.uk data.',
        colour: 'bg-emerald-50 text-emerald-600',
        iconBg: 'bg-gradient-to-br from-emerald-400 to-emerald-600',
        iconText: 'text-white',
        link: '/safety/GU2 7',
        linkLabel: 'Explore safety data',
    },
    {
        icon: PoundSterling,
        title: 'AI Rent Predictor',
        desc: 'XGBoost ML model trained on 3,500+ Guildford properties. Know if the rent is fair before you sign.',
        colour: 'bg-indigo-50 text-indigo-600',
        iconBg: 'bg-gradient-to-br from-indigo-500 to-indigo-700',
        iconText: 'text-white',
        link: '/search',
        linkLabel: 'Check rent fairness',
    },
    {
        icon: HomeIcon,
        title: 'HMO Compliance',
        desc: "Instant HMO licence verification against Guildford Borough Council's official register. Know your rights in shared houses.",
        colour: 'bg-amber-50 text-amber-600',
        iconBg: 'bg-gradient-to-br from-amber-400 to-orange-500',
        iconText: 'text-white',
        link: '/rights',
        linkLabel: 'Learn about HMO',
    },
]

export const STEPS = [
    { num: 1, icon: Search, title: 'Search a postcode', desc: 'Enter any Guildford postcode to find nearby rental properties within your chosen radius.' },
    { num: 2, icon: BarChart3, title: 'Compare side by side', desc: 'View detailed rent fairness, safety ratings, and HMO status. Add properties to compare.' },
    { num: 3, icon: CheckCircle2, title: 'Decide with confidence', desc: 'Choose the best student home backed by real data from official UK sources.' },
]

export const TRUST_ITEMS = [
    { icon: Database, label: '3,500+', desc: 'Properties Analysed' },
    { icon: Shield, label: 'Police.uk', desc: 'Crime Data' },
    { icon: Brain, label: 'ML-Powered', desc: 'Rent Predictions' },
    { icon: CheckCircle2, label: 'Official', desc: 'Data Sources' },
]
