/**
 * CrimeBreakdown — horizontal bars for crime categories.
 * Student-friendly category names, bars sized relative to max count.
 *
 * @param {{ breakdown: Array<{category: string, total_count: number}>, className?: string }} props
 */
import { useRef, useState, useEffect } from 'react'
import {
    Volume2, Lock, AlertTriangle, Car,
    ShoppingBag, AlertOctagon, Pill, Users,
} from 'lucide-react'

// Map police.uk slugs → student-friendly names + icons
const CATEGORY_MAP = {
    'anti-social-behaviour': { name: 'Noise & disturbances', Icon: Volume2 },
    'burglary': { name: 'Break-ins', Icon: Lock },
    'violent-crime': { name: 'Violent incidents', Icon: AlertTriangle },
    'vehicle-crime': { name: 'Car-related crime', Icon: Car },
    'theft-from-the-person': { name: 'Theft (personal)', Icon: ShoppingBag },
    'robbery': { name: 'Robbery', Icon: AlertOctagon },
    'drugs': { name: 'Drug offences', Icon: Pill },
    'public-order': { name: 'Public order', Icon: Users },
}

export default function CrimeBreakdown({ breakdown = [], className = '' }) {
    const containerRef = useRef(null)
    const [inView, setInView] = useState(false)

    useEffect(() => {
        if (!containerRef.current) return
        const obs = new IntersectionObserver(
            ([entry]) => { if (entry.isIntersecting) setInView(true) },
            { threshold: 0.2 }
        )
        obs.observe(containerRef.current)
        return () => obs.disconnect()
    }, [])

    if (!breakdown.length) return null

    const max = Math.max(...breakdown.map((b) => b.total_count), 1)

    return (
        <div ref={containerRef} className={`space-y-3 ${className}`}>
            {breakdown.map((item, i) => {
                const meta = CATEGORY_MAP[item.category] || {
                    name: item.category.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
                    Icon: AlertTriangle,
                }
                const pct = (item.total_count / max) * 100

                return (
                    <div key={item.category}>
                        <div className="flex items-center gap-2 mb-1">
                            <meta.Icon size={13} className="text-gray-400 flex-shrink-0" />
                            <span className="text-xs text-gray-600">{meta.name}</span>
                            <span className="text-xs font-medium text-gray-900 ml-auto">
                                {item.total_count}
                            </span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-indigo-500 rounded-full transition-all duration-600 ease-out"
                                style={{
                                    width: inView ? `${pct}%` : '0%',
                                    transitionDelay: `${i * 50}ms`,
                                }}
                            />
                        </div>
                    </div>
                )
            })}
        </div>
    )
}
