/**
 * AdminDashboard — thin orchestrator for the admin portal.
 * Manages activeTab state only. Each tab fetches its own data.
 * No <Navbar> — AdminLayout provides the full-screen shell.
 */
import { useState } from 'react'
import AdminLayout from '../components/admin/AdminLayout'
import OverviewTab from '../components/admin/overview/OverviewTab'
import AnalyticsTab from '../components/admin/analytics/AnalyticsTab'
import UsersTab from '../components/admin/users/UsersTab'
import SubscriptionsTab from '../components/admin/subscriptions/SubscriptionsTab'
import ReviewsTab from '../components/admin/reviews/ReviewsTab'
import PipelinesTab from '../components/admin/pipelines/PipelinesTab'

export default function AdminDashboard() {
    const [activeTab, setActiveTab] = useState('overview')
    const [pendingReviews, setPendingReviews] = useState(0)

    return (
        <AdminLayout
            activeTab={activeTab}
            onTabChange={setActiveTab}
            pendingReviews={pendingReviews}
        >
            {activeTab === 'overview' && (
                <OverviewTab onTabChange={setActiveTab} onPendingCount={setPendingReviews} />
            )}
            {activeTab === 'analytics' && <AnalyticsTab />}
            {activeTab === 'users' && <UsersTab />}
            {activeTab === 'subscriptions' && <SubscriptionsTab />}
            {activeTab === 'reviews' && <ReviewsTab />}
            {activeTab === 'pipelines' && <PipelinesTab />}
        </AdminLayout>
    )
}
