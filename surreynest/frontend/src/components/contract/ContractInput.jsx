/**
 * ContractInput — tab switcher for paste text or upload file.
 *
 * @param {{ text: string, onChange: Function }} props
 */
import { useState, useRef } from 'react'
import { FileText, Upload } from 'lucide-react'

export default function ContractInput({ text, onChange }) {
    const [tab, setTab] = useState('paste')
    const [dragOver, setDragOver] = useState(false)
    const fileRef = useRef(null)

    const MAX_CHARS = 50_000

    function handleFile(file) {
        if (!file) return

        if (file.type === 'text/plain' || file.name.endsWith('.txt')) {
            const reader = new FileReader()
            reader.onload = (e) => onChange(e.target.result.slice(0, MAX_CHARS))
            reader.readAsText(file)
            return
        }

        // PDF: try pdfjs-dist if available
        if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
            import('pdfjs-dist').then(async (pdfjsLib) => {
                pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js'
                const arrayBuffer = await file.arrayBuffer()
                const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
                let fullText = ''
                for (let i = 1; i <= pdf.numPages; i++) {
                    const page = await pdf.getPage(i)
                    const content = await page.getTextContent()
                    fullText += content.items.map(item => item.str).join(' ') + '\n'
                }
                onChange(fullText.slice(0, MAX_CHARS))
            }).catch(() => {
                alert('PDF parsing failed. Please copy and paste the text instead.')
            })
            return
        }

        alert('Please upload a .txt or .pdf file.')
    }

    function handleDrop(e) {
        e.preventDefault()
        setDragOver(false)
        handleFile(e.dataTransfer.files[0])
    }

    return (
        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm space-y-4">
            <h2 className="text-lg font-extrabold text-slate-900">Your Tenancy Agreement</h2>

            {/* Tab switcher */}
            <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit">
                {[
                    { id: 'paste', icon: FileText, label: 'Paste Text' },
                    { id: 'upload', icon: Upload, label: 'Upload File' },
                ].map(({ id, icon: Icon, label }) => (
                    <button
                        key={id}
                        onClick={() => setTab(id)}
                        className={`flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded-lg transition-colors ${
                            tab === id
                                ? 'bg-white text-slate-900 shadow-sm'
                                : 'text-slate-500 hover:text-slate-700'
                        }`}
                    >
                        <Icon size={14} />
                        {label}
                    </button>
                ))}
            </div>

            {tab === 'paste' ? (
                <div className="space-y-2">
                    <textarea
                        value={text}
                        onChange={e => onChange(e.target.value.slice(0, MAX_CHARS))}
                        rows={10}
                        placeholder="Paste your tenancy agreement text here..."
                        className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm placeholder:text-slate-400 focus:outline-none focus:border-primary transition-colors resize-none font-mono"
                    />
                    <p className={`text-xs text-right ${text.length > MAX_CHARS * 0.9 ? 'text-amber-600' : 'text-slate-400'}`}>
                        {text.length.toLocaleString()}/{MAX_CHARS.toLocaleString()}
                    </p>
                </div>
            ) : (
                <div
                    onDrop={handleDrop}
                    onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                    onDragLeave={() => setDragOver(false)}
                    onClick={() => fileRef.current?.click()}
                    className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
                        dragOver
                            ? 'border-primary-400 bg-primary/10'
                            : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                >
                    <Upload size={24} className="mx-auto text-slate-400 mb-3" />
                    <p className="text-sm font-medium text-slate-600">
                        Drop a .txt or .pdf file here
                    </p>
                    <p className="text-xs text-slate-400 mt-1">or click to browse</p>
                    <input
                        ref={fileRef}
                        type="file"
                        accept=".txt,.pdf"
                        className="hidden"
                        onChange={e => handleFile(e.target.files[0])}
                    />
                </div>
            )}

            {text.length > 0 && (
                <p className="text-xs text-emerald-600 font-medium">
                    ✓ {text.length.toLocaleString()} characters loaded
                </p>
            )}
        </div>
    )
}
