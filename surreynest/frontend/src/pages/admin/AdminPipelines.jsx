import { useState, useEffect, useCallback } from 'react'
import { Activity, RefreshCw, AlertCircle, CheckCircle2, Play, Clock, Database } from 'lucide-react'
import { adminApi } from '../../services/adminApi'

const DISPLAY_NAMES = {
    crime_pipeline: 'Crime Data',
    hmo_pipeline: 'HMO Register',
    epc_pipeline: 'EPC Certificates',
    land_registry_pipeline: 'Land Registry',
    flood_pipeline: 'Flood Risk',
}

const STATUS_CONFIG = {
    success: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', icon: CheckCircle2 },
    running: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', icon: RefreshCw, animate: true },
    failed: { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', icon: AlertCircle },
    never_run: { bg: 'bg-slate-50', text: 'text-slate-600', border: 'border-slate-200', icon: Clock },
}

function relativeTime(isoString) {
    if (!isoString) return 'Never run'
    const diff = Date.now() - new Date(isoString).getTime()
    const minutes = Math.floor(diff / 60000)
    if (minutes < 1) return 'Just now'
    if (minutes < 60) return `${minutes} min${minutes !== 1 ? 's' : ''} ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours} hr${hours !== 1 ? 's' : ''} ago`
    const days = Math.floor(hours / 24)
    return `${days} day${days !== 1 ? 's' : ''} ago`
}

export default function AdminPipelines() {
    const [pipelines, setPipelines] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [triggering, setTriggering] = useState({})

    const load = useCallback(() => {
        setLoading(true)
        setError(null)
        adminApi.getPipelineStatus()
            .then((data) => {
                const parsed = Array.isArray(data) 
                    ? data 
                    : Object.entries(data).map(([name, info]) => ({ name, ...info }))
                
                // Add any missing expected pipelines that aren't in the response yet
                const expected = Object.keys(DISPLAY_NAMES)
                const existingNames = parsed.map(p => p.name || p.pipeline_name)
                
                expected.forEach(ex => {
                    if (!existingNames.includes(ex)) {
                        parsed.push({ name: ex, status: 'never_run' })
                    }
                })

                setPipelines(parsed)
            })
            .catch((e) => setError(e.message))
            .finally(() => setLoading(false))
    }, [])

    useEffect(() => {
        load()
    }, [load])

    async function handleTrigger(name) {
        setTriggering((t) => ({ ...t, [name]: 'queuing' }))
        try {
            await adminApi.triggerPipeline(name)
            setTriggering((t) => ({ ...t, [name]: 'queued' }))
            setTimeout(() => {
                setTriggering((t) => ({ ...t, [name]: null }))
                load()
            }, 2000)
        } catch (e) {
            setTriggering((t) => ({ ...t, [name]: null }))
            alert(`Failed to trigger ${name}: ${e.message}`)
        }
    }

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Data Pipelines</h1>
                    <p className="text-sm text-slate-500 mt-1">Monitor automated data ingestion tasks.</p>
                </div>
                <button
                    onClick={load}
                    disabled={loading}
                    className="flex items-center justify-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
                >
                    <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                    Refresh Status
                </button>
            </div>

            {error && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-xl flex items-start gap-3">
                    <AlertCircle size={20} className="shrink-0 mt-0.5" />
                    <div>
                        <h3 className="text-sm font-semibold">Error loading pipelines</h3>
                        <p className="text-sm mt-1">{error}</p>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {loading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="animate-pulse bg-white border border-slate-200 rounded-xl h-48" />
                    ))
                ) : (
                    pipelines.map((p) => {
                        const name = p.name || p.pipeline_name
                        const rawStatus = p.status || 'never_run'
                        
                        // Treat any unknown status as 'never_run' visually to avoid crashes
                        const statusConf = STATUS_CONFIG[rawStatus] || STATUS_CONFIG.never_run
                        const StatusIcon = statusConf.icon
                        
                        const trigState = triggering[name]
                        const isRunning = rawStatus === 'running' || trigState === 'queuing'

                        return (
                            <div key={name} className={`bg-white rounded-xl border ${statusConf.border} shadow-sm overflow-hidden flex flex-col`}>
                                <div className="p-5 flex-1 relative">
                                    <div className="flex items-start justify-between mb-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600 text-primary">
                                                <Database size={20} className="text-primary" />
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-slate-900 leading-tight">
                                                    {DISPLAY_NAMES[name] || name}
                                                </h3>
                                                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 mt-1 rounded text-[10px] font-bold uppercase tracking-widest ${statusConf.bg} ${statusConf.text} border ${statusConf.border}`}>
                                                    <StatusIcon size={12} className={statusConf.animate ? 'animate-spin' : ''} />
                                                    {rawStatus.replace('_', ' ')}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div className="space-y-2 mb-4">
                                        <div className="flex items-center text-sm text-slate-600">
                                            <span className="w-24 text-slate-400">Last run:</span>
                                            <span className="font-medium text-slate-900">{relativeTime(p.finished_at || p.started_at)}</span>
                                        </div>
                                        {p.rows_processed != null && (
                                            <div className="flex items-center text-sm text-slate-600">
                                                <span className="w-24 text-slate-400">Processed:</span>
                                                <span className="font-medium text-slate-900">{p.rows_processed.toLocaleString()} rows</span>
                                            </div>
                                        )}
                                    </div>

                                    {rawStatus === 'failed' && p.error_message && (
                                        <div className="bg-rose-50 rounded-lg p-3 text-xs text-rose-700 leading-relaxed max-h-24 overflow-y-auto mb-2 border border-rose-100">
                                            {p.error_message}
                                        </div>
                                    )}
                                </div>

                                <div className="px-5 py-4 bg-slate-50 border-t border-slate-100 mt-auto">
                                    <button
                                        onClick={() => handleTrigger(name)}
                                        disabled={!!trigState || isRunning}
                                        className="w-full flex items-center justify-center gap-2 bg-white border border-slate-200 text-slate-700 rounded-lg px-4 py-2 text-sm font-medium hover:bg-primary hover:text-white hover:border-primary transition-colors disabled:opacity-50 disabled:hover:bg-white disabled:hover:border-slate-200 disabled:hover:text-slate-700"
                                    >
                                        {trigState === 'queuing' ? (
                                            <><RefreshCw size={16} className="animate-spin" /> Queuing...</>
                                        ) : trigState === 'queued' ? (
                                            <><CheckCircle2 size={16} className="text-emerald-500" /> Queued</>
                                        ) : isRunning ? (
                                            <><RefreshCw size={16} className="animate-spin" /> Running...</>
                                        ) : (
                                            <><Play size={16} /> Run Pipeline Manually</>
                                        )}
                                    </button>
                                </div>
                            </div>
                        )
                    })
                )}
            </div>
        </div>
    )
}
