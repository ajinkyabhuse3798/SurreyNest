/**
 * TribunalBrief — displays and exports the tribunal application brief.
 *
 * @param {{ brief: string }} props
 */
import { useState } from 'react'
import { Copy, Download, Check } from 'lucide-react'

export default function TribunalBrief({ brief }) {
    const [copied, setCopied] = useState(false)

    function handleCopy() {
        navigator.clipboard.writeText(brief).then(() => {
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        })
    }

    function handleDownload() {
        const blob = new Blob([brief], { type: 'text/plain' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'section-13-challenge.txt'
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
    }

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-extrabold text-slate-800">
                    Tribunal Application Brief
                </h3>
                <div className="flex gap-2">
                    <button
                        onClick={handleCopy}
                        className="flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 border border-slate-200 rounded-lg px-3 py-1.5 hover:bg-slate-50 transition-colors"
                    >
                        {copied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                        {copied ? 'Copied' : 'Copy'}
                    </button>
                    <button
                        onClick={handleDownload}
                        className="flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-700 border border-indigo-200 rounded-lg px-3 py-1.5 hover:bg-indigo-50 transition-colors"
                    >
                        <Download size={13} />
                        Download .txt
                    </button>
                </div>
            </div>
            <pre className="bg-slate-900 text-slate-100 rounded-xl p-5 text-xs font-mono leading-relaxed overflow-x-auto whitespace-pre-wrap">
                {brief}
            </pre>
        </div>
    )
}
