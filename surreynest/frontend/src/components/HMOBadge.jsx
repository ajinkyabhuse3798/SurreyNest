/**
 * HMOBadge, licensed/expired/unknown pill indicator.
 * Per design-system.md: coloured pill with border, rounded-full.
 *
 * @param {{ status: 'licensed'|'expired'|'not_found' }} props
 */
const styles = {
    licensed: 'bg-green-50 text-green-700 border-green-200',
    expired: 'bg-amber-50 text-amber-700 border-amber-200',
    not_found: 'bg-gray-50 text-gray-500 border-gray-200',
}

const labels = {
    licensed: '✓ HMO Licensed',
    expired: '⚠ HMO Expired',
    not_found: 'HMO Unknown',
}

export default function HMOBadge({ status = 'not_found' }) {
    return (
        <span
            className={`text-xs px-2 py-0.5 rounded-full border ${styles[status] || styles.not_found}`}
        >
            {labels[status] || labels.not_found}
        </span>
    )
}
