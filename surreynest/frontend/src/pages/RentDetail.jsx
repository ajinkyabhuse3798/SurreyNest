/**
 * RentDetail v2 — Thin orchestrator for the rent XAI page.
 *
 * Route: /rent/:uprn
 *
 * All visual sections are extracted into focused sub-components
 * under components/rent/. This file retains only state, fetch,
 * and section composition.
 */
import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
    ArrowLeft, BarChart3, Lightbulb, Layers,
    TrendingUp, AlertCircle, Brain, Target,
} from 'lucide-react'
import Navbar from '../components/Navbar'
import Section from '../components/ui/Section'
import api from '../services/api'

// ── Sub-components ───────────────────────────────────────────────────────────
import ProGate from '../components/ProGate'
import RentHero from '../components/rent/RentHero'
import WaterfallChart from '../components/rent/WaterfallChart'
import TopFactors from '../components/rent/TopFactors'
import FeatureDeepDive from '../components/rent/FeatureDeepDive'
import RentComparison from '../components/rent/RentComparison'
import ModelExplainer from '../components/rent/ModelExplainer'
import GlobalImportance from '../components/rent/GlobalImportance'


// ── Skeleton ─────────────────────────────────────────────────────────────────

function PageSkeleton() {
    return (
        <div className="space-y-6 animate-pulse">
            <div className="h-44 bg-slate-100 rounded-2xl" />
            <div className="h-64 bg-slate-100 rounded-2xl" />
            <div className="h-48 bg-slate-100 rounded-2xl" />
            <div className="h-32 bg-slate-100 rounded-2xl" />
        </div>
    )
}


// ── Main component ───────────────────────────────────────────────────────────

export default function RentDetail() {
    const { uprn } = useParams()
    const navigate = useNavigate()

    const [data, setData] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    useEffect(() => {
        if (!uprn) return
        setLoading(true)
        setError(null)

        api.get(`/api/rent/explain/${uprn}`)
            .then(r => setData(r.data))
            .catch(err => {
                const msg = err.response?.data?.detail || 'Could not load rent explanation.'
                setError(msg)
            })
            .finally(() => setLoading(false))
    }, [uprn])

    return (
        <div className="min-h-screen bg-[#f8f9fc]">
            <Navbar />

            <div className="max-w-3xl mx-auto px-4 pt-4 pb-20">
                <button
                    onClick={() => navigate(-1)}
                    className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-primary transition-colors mb-4 group"
                >
                    <ArrowLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
                    Back to property
                </button>

                {loading ? (
                    <PageSkeleton />
                ) : error ? (
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-8 text-center">
                        <AlertCircle size={48} className="text-slate-300 mx-auto mb-4" />
                        <h2 className="text-lg font-bold text-slate-700 mb-2">Cannot Explain This Prediction</h2>
                        <p className="text-sm text-slate-500">{error}</p>
                        <button onClick={() => navigate(-1)} className="mt-4 text-sm text-primary font-medium hover:text-primary/90">
                            ← Go back
                        </button>
                    </div>
                ) : data ? (
                    <div className="space-y-5">
                        {/* 1. Hero */}
                        <RentHero data={data} />

                        {/* 2–7. Full XAI breakdown — Pro only */}
                        <ProGate feature="Full rent breakdown with AI explanations">
                            <div className="space-y-5">
                                {/* 2. Waterfall Chart */}
                                <Section icon={BarChart3} title="What affects this rent?" subtitle="Each bar shows how much a feature pushes the rent up (↑) or down (↓)">
                                    <p className="text-sm text-slate-500 mb-4 leading-relaxed">
                                        Our model looked at <span className="font-semibold text-slate-700">{data.feature_contributions.length} features</span> of this property.
                                        Here are the biggest factors that determined the predicted rent:
                                    </p>
                                    <WaterfallChart contributions={data.feature_contributions} />
                                </Section>

                                {/* 3. Top 3 Factors */}
                                <Section icon={Lightbulb} title="The 3 biggest reasons for this rent" subtitle="In plain English — why this property costs what it does">
                                    <TopFactors contributions={data.feature_contributions} />
                                </Section>

                                {/* 4. Feature Deep-Dive */}
                                <Section icon={Layers} title="All features the model considered" subtitle="Every data point that went into the prediction">
                                    <FeatureDeepDive contributions={data.feature_contributions} />
                                </Section>

                                {/* 5. Rent Comparison */}
                                <Section icon={TrendingUp} title="How does this compare to other rents?" subtitle="This prediction vs the area average and Guildford average">
                                    <RentComparison predicted={data.predicted_weekly_rent} comparison={data.rent_comparison} />
                                </Section>

                                {/* 6. How the Model Works */}
                                <Section icon={Brain} title="How does the AI calculate rent?" subtitle="A simple explanation of the 3-step process">
                                    <ModelExplainer modelInfo={data.model_info} />
                                </Section>

                                {/* 7. Global Importance */}
                                <Section icon={Target} title="What matters most across all of Guildford?" subtitle="Features ranked by global importance — not just for this property">
                                    <GlobalImportance importance={data.global_feature_importance} />
                                </Section>
                            </div>
                        </ProGate>

                        {/* Footer */}
                        <div className="text-center text-xs text-slate-400 pt-4 pb-8">
                            <p>Model: <span className="font-medium">{data.model_info.algorithm}</span> · Trained on {data.model_info.training_properties?.toLocaleString()} Guildford properties</p>
                            <p className="mt-1">Predictions are estimates based on property data. Actual rent depends on landlord, condition, and market timing.</p>
                        </div>
                    </div>
                ) : null}
            </div>
        </div>
    )
}
