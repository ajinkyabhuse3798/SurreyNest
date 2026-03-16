/**
 * AdminHeader — white top bar with page title and admin badge.
 */
const TAB_TITLES = {
    overview:      'Overview',
    analytics:     'Analytics',
    users:         'Users',
    subscriptions: 'Subscriptions',
    reviews:       'Reviews',
    pipelines:     'Pipelines',
}

export default function AdminHeader({ activeTab }) {
    const title = TAB_TITLES[activeTab] || 'Dashboard'

    return (
        <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between flex-shrink-0">
            <div>
                <h1 className="text-base font-bold text-slate-900">{title}</h1>
                <p className="text-xs text-slate-400 mt-0.5">Admin / {title}</p>
            </div>
            <span className="bg-primary/10 text-primary text-xs font-bold px-3 py-1 rounded-full">
                Admin
            </span>
        </header>
    )
}
