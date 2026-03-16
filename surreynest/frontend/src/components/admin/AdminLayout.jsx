/**
 * AdminLayout — full-screen shell that clips the public footer.
 * Left: AdminSidebar. Right: AdminHeader + scrollable content area.
 */
import AdminSidebar from './AdminSidebar'
import AdminHeader from './AdminHeader'

export default function AdminLayout({ activeTab, onTabChange, pendingReviews, children }) {
    return (
        <div className="flex h-screen overflow-hidden bg-slate-50">
            <AdminSidebar
                activeTab={activeTab}
                onTabChange={onTabChange}
                pendingReviews={pendingReviews}
            />
            <div className="flex-1 flex flex-col overflow-hidden">
                <AdminHeader activeTab={activeTab} />
                <main className="flex-1 overflow-y-auto p-6">
                    {children}
                </main>
            </div>
        </div>
    )
}
