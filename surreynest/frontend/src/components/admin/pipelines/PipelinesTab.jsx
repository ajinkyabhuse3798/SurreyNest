/**
 * PipelinesTab — pipeline health cards with trigger button.
 */
import { useState, useEffect } from 'react'
import { Activity, RefreshCw } from 'lucide-react'
import { getPipelineStatus, triggerPipeline } from '../../../services/adminApi'

const DISPLAY_NAMES = {
    crime_pipeline:          'Crime Data',
    hmo_pipeline:            'HMO Register',
    epc_pipeline:            'EPC Certificates',
    land_registry_pipeline:  'Land Registry',
    flood_pipeline:          'Flood Risk',
}

const STATUS_STYLES = {
    success:   'bg-emerald-100 text-emerald-700',
    running:   'bg-blue-100 text-blue-700 animate-pulse',
    failed:    'bg-rose-100 text-rose-700',
    never_run: 'bg-slate-100 text-slate-600',
}

function relativeTime(isoString) {
    if (!isoString) return 'Never'
    const diff = Date.now() - new Date(isoString).getTime()
    const minutes = Math.floor(diff / 60000)
    if (minutes < 1) return 'Just now'
    if (minutes < 60) return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`
    const days = Math.floor(hours / 24)
    return `${days} day${days !== 1 ? 's' : ''} ago`
}

export default function PipelinesTab() {
    const [pipelines, setPipelines] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [triggering, setTriggering] = useState({})

    function load() {
        setLoading(true)
        setError(null)
        getPipelineStatus()
            .then((data) => setPipelines(Array.isArray(data) ? data : Object.entries(data).map(([name, info]) => ({ name, ...info }))))
            .catch((e) => setError(e.message))
            .finally(() => setLoading(false))
    }

    useEffect(() => { load() }, [])

    async function handleTrigger(name) {
        setTriggering((t) => ({ ...t, [name]: 'queuing' }))
        try {
            await triggerPipeline(name)
            setTriggering((t) => ({ ...t, [name]: 'queued' }))
            setTimeout(() => {
                setTriggering((t) => ({ ...t, [name]: null }))
                load()
            }, 2000)
        } catch (e) {
            setTriggering((t) => ({ ...t, [name]: null }))
            alert(e.message)
        }
    }

    if (loading) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="animate-pulse bg-slate-100 rounded-2xl h-40" />
                ))}
            </div>
        )
    }

    if (error) {
        return (
            <div className="bg-rose-50 border border-rose-200 rounded-xl px-4 py-3 text-sm text-rose-700">
                {error}
            </div>
        )
    }

    return (
        <div>
            <div className="flex justify-end mb-4">
                <button
                    onClick={load}
                    className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800 transition-colors"
                >
                    <RefreshCw size={14} />
                    Refresh
                </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {pipelines.map((p) => {
                    const name = p.name || p.pipeline_name
                    const status = p.status || 'never_run'
                    const trigState = triggering[name]
                    return (
                        <div key={name} className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
                            <div className="flex items-start justify-between mb-3">
                                <div className="w-9 h-9 bg-primary/10 rounded-xl flex items-center justify-center">
                                    <Activity size={16} className="text-primary" />
                                </div>
                                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_STYLES[status] || STATUS_STYLES.never_run}`}>
                                    {status.replace('_', ' ')}
                                </span>
                            </div>
                            <h3 className="font-bold text-slate-800 text-sm mb-1">
                                {DISPLAY_NAMES[name] || name}
                            </h3>
                            <p className="text-xs text-slate-400 mb-1">
                                Last run: {relativeTime(p.finished_at || p.started_at)}
                            </p>
                            {p.rows_processed != null && (
                                <p className="text-xs text-slate-400 mb-2">
                                    {p.rows_processed.toLocaleString()} rows
                                </p>
                            )}
                            {status === 'failed' && p.error_message && (
                                <div className="bg-rose-50 rounded-lg p-2 text-xs text-rose-700 mb-3">
                                    {p.error_message}
                                </div>
                            )}
                            <button
                                onClick={() => handleTrigger(name)}
                                disabled={!!trigState || status === 'running'}
                                className="mt-1 text-xs font-semibold text-primary hover:text-primary/80 transition-colors disabled:opacity-50"
                            >
                                {trigState === 'queuing' ? 'Queuing…' : trigState === 'queued' ? 'Queued ✓' : 'Run Now'}
                            </button>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
