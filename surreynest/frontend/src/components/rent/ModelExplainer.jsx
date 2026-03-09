/**
 * ModelExplainer — 3-step explanation of how the rent model works.
 */
import { Database, GitBranch, Brain } from 'lucide-react'

export default function ModelExplainer({ modelInfo }) {
    const steps = [
        {
            icon: Database,
            title: 'Step 1: Collect property data',
            description: 'We pull data from the Energy Performance Certificate (EPC) register, police.uk crime reports, Land Registry sale prices, and postcode locations.',
            detail: `${modelInfo?.training_properties?.toLocaleString() || '18,000+'} properties in the Guildford area`,
        },
        {
            icon: GitBranch,
            title: `Step 2: Extract ${modelInfo?.feature_count || 15} features`,
            description: 'For each property, we compute features like floor area, room count, distance to university, local crime rate, and property type — the same factors that affect real rents.',
            detail: 'Each feature is scaled and normalised before being fed to the model',
        },
        {
            icon: Brain,
            title: 'Step 3: XGBoost predicts a fair rent',
            description: 'Our XGBoost model (a type of machine learning that uses hundreds of decision trees) looks at all the features together and predicts what a fair weekly rent should be.',
            detail: 'The model learns patterns from thousands of real Guildford properties',
        },
    ]

    return (
        <div className="space-y-4">
            {steps.map((step, i) => (
                <div key={i} className="flex gap-4 items-start">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0">
                        <step.icon size={16} className="text-indigo-600" />
                    </div>
                    <div className="flex-1">
                        <h3 className="text-sm font-bold text-slate-800">{step.title}</h3>
                        <p className="text-xs text-slate-500 mt-1 leading-relaxed">{step.description}</p>
                        <p className="text-[10px] text-slate-400 mt-1 italic">{step.detail}</p>
                    </div>
                </div>
            ))}
        </div>
    )
}
