/**
 * RentHero, Green gradient hero with rent prediction.
 */
import { PoundSterling } from 'lucide-react'

export default function RentHero({ data }) {
    return (
        <div className="bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-700 rounded-2xl p-6 text-white shadow-lg shadow-emerald-200/50">
            <div className="flex items-center gap-2 text-emerald-200 text-xs font-medium mb-2">
                <PoundSterling size={14} />
                RENT PREDICTION EXPLAINED
            </div>
            <h1 className="text-xl font-black mb-0.5">
                {data.property.address}
            </h1>
            <p className="text-emerald-200 text-sm mb-5">
                {data.property.postcode} · {data.property.property_type} · {data.property.floor_area_m2} m² · {data.property.estimated_bedrooms} bed{data.property.estimated_bedrooms !== 1 ? 's' : ''}
            </p>

            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-5 text-center">
                <p className="text-emerald-200 text-sm font-medium">Our AI predicts a fair rent of</p>
                <p className="text-4xl font-black mt-1">
                    £{Math.round(data.predicted_weekly_rent)}
                    <span className="text-lg font-medium text-emerald-200">/week</span>
                </p>
                <p className="text-emerald-300 text-sm mt-1">
                    ≈ £{Math.round(data.predicted_weekly_rent * 52 / 12)}/month
                </p>
                <p className="text-emerald-300/60 text-xs mt-2">
                    Model {data.model_version} · {data.model_info.algorithm}
                </p>
            </div>
        </div>
    )
}
