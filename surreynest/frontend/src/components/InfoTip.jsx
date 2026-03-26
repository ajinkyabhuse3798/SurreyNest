/**
 * InfoTip, reusable (i) tooltip for technical terms.
 * Mobile-friendly: click/tap to show, tap-outside to dismiss.
 *
 * @param {{ text: string, className?: string }} props
 */
import { useState, useRef, useEffect } from 'react'
import { Info } from 'lucide-react'

export default function InfoTip({ text, className = '' }) {
    const [open, setOpen] = useState(false)
    const ref = useRef(null)

    useEffect(() => {
        if (!open) return
        function handleClick(e) {
            if (ref.current && !ref.current.contains(e.target)) setOpen(false)
        }
        document.addEventListener('pointerdown', handleClick)
        return () => document.removeEventListener('pointerdown', handleClick)
    }, [open])

    return (
        <span ref={ref} className={`relative inline-flex items-center ${className}`}>
            <button
                onClick={() => setOpen((o) => !o)}
                className="p-1.5 -m-1 text-gray-400 hover:text-primary transition-colors"
                aria-label="More information"
                type="button"
            >
                <Info size={14} />
            </button>
            {open && (
                <div
                    className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-60 bg-gray-900 text-white text-xs rounded-lg px-3 py-2 shadow-lg leading-relaxed animate-[fadeIn_150ms_ease-out]"
                    role="tooltip"
                >
                    {text}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
                </div>
            )}
        </span>
    )
}
