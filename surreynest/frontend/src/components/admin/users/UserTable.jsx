/**
 * UserTable — sortable, paginatable user table with inline editing.
 */
import { useState } from 'react'
import { Crown } from 'lucide-react'
import { updateUser } from '../../../services/adminApi'

const ROLE_STYLES = {
    admin:    'bg-rose-100 text-rose-700',
    landlord: 'bg-indigo-100 text-indigo-700',
    student:  'bg-slate-100 text-slate-600',
}

function fmt(iso) {
    if (!iso) return '—'
    return new Date(iso).toLocaleDateString('en-GB')
}

function toDateInput(iso) {
    if (!iso) return ''
    return iso.split('T')[0]
}

export default function UserTable({ users, total, page, pages, onPage, onUpdated }) {
    const [editingId, setEditingId] = useState(null)
    const [editData, setEditData] = useState({})
    const [saving, setSaving] = useState(false)
    const [saveError, setSaveError] = useState(null)

    function startEdit(user) {
        setEditingId(user.id)
        setEditData({
            role: user.role,
            is_pro: user.is_pro,
            pro_expires_at: toDateInput(user.pro_expires_at),
        })
        setSaveError(null)
    }

    function cancelEdit() {
        setEditingId(null)
        setEditData({})
        setSaveError(null)
    }

    async function saveEdit(userId) {
        setSaving(true)
        setSaveError(null)
        try {
            const body = {
                role: editData.role,
                is_pro: editData.is_pro,
                pro_expires_at: editData.pro_expires_at ? editData.pro_expires_at + 'T00:00:00Z' : null,
            }
            const updated = await updateUser(userId, body)
            onUpdated(updated)
            setEditingId(null)
        } catch (e) {
            setSaveError(e.message)
        } finally {
            setSaving(false)
        }
    }

    if (users.length === 0) {
        return (
            <div className="py-16 text-center text-sm text-slate-400">No users found.</div>
        )
    }

    return (
        <div>
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="bg-slate-50 text-left">
                            <th className="px-4 py-3 text-xs font-semibold text-slate-500">Email</th>
                            <th className="px-4 py-3 text-xs font-semibold text-slate-500">Role</th>
                            <th className="px-4 py-3 text-xs font-semibold text-slate-500">Pro</th>
                            <th className="px-4 py-3 text-xs font-semibold text-slate-500">Joined</th>
                            <th className="px-4 py-3 text-xs font-semibold text-slate-500">Last Login</th>
                            <th className="px-4 py-3 text-xs font-semibold text-slate-500">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {users.map((user) => {
                            const isEditing = editingId === user.id
                            return (
                                <tr key={user.id} className="hover:bg-slate-50/50 transition-colors">
                                    {/* Email */}
                                    <td className="px-4 py-3 text-slate-800 font-medium max-w-[180px] truncate">
                                        {user.email}
                                    </td>

                                    {/* Role */}
                                    <td className="px-4 py-3">
                                        {isEditing ? (
                                            <select
                                                value={editData.role}
                                                onChange={(e) => setEditData((d) => ({ ...d, role: e.target.value }))}
                                                className="border border-slate-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-primary/30"
                                            >
                                                <option value="student">Student</option>
                                                <option value="landlord">Landlord</option>
                                                <option value="admin">Admin</option>
                                            </select>
                                        ) : (
                                            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${ROLE_STYLES[user.role] || ROLE_STYLES.student}`}>
                                                {user.role}
                                            </span>
                                        )}
                                    </td>

                                    {/* Pro */}
                                    <td className="px-4 py-3">
                                        {isEditing ? (
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="checkbox"
                                                    checked={editData.is_pro}
                                                    onChange={(e) => setEditData((d) => ({ ...d, is_pro: e.target.checked }))}
                                                    className="accent-primary"
                                                />
                                                {editData.is_pro && (
                                                    <input
                                                        type="date"
                                                        value={editData.pro_expires_at}
                                                        onChange={(e) => setEditData((d) => ({ ...d, pro_expires_at: e.target.value }))}
                                                        className="border border-slate-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-primary/30"
                                                    />
                                                )}
                                            </div>
                                        ) : user.is_pro ? (
                                            <div className="flex items-center gap-1.5">
                                                <Crown size={12} className="text-amber-500 fill-amber-500" />
                                                <span className="text-xs font-semibold text-amber-600">Pro</span>
                                                {user.pro_expires_at && (
                                                    <span className="text-xs text-slate-400">
                                                        · {fmt(user.pro_expires_at)}
                                                    </span>
                                                )}
                                            </div>
                                        ) : (
                                            <span className="text-slate-300 text-sm">—</span>
                                        )}
                                    </td>

                                    {/* Joined */}
                                    <td className="px-4 py-3 text-slate-500 text-xs">{fmt(user.created_at)}</td>

                                    {/* Last Login */}
                                    <td className="px-4 py-3 text-slate-500 text-xs">{fmt(user.last_login)}</td>

                                    {/* Actions */}
                                    <td className="px-4 py-3">
                                        {isEditing ? (
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => saveEdit(user.id)}
                                                    disabled={saving}
                                                    className="text-xs font-semibold text-primary hover:text-primary/80 disabled:opacity-50"
                                                >
                                                    {saving ? 'Saving…' : 'Save'}
                                                </button>
                                                <button
                                                    onClick={cancelEdit}
                                                    className="text-xs text-slate-400 hover:text-slate-700"
                                                >
                                                    Cancel
                                                </button>
                                                {saveError && (
                                                    <span className="text-xs text-rose-600">{saveError}</span>
                                                )}
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => startEdit(user)}
                                                className="text-xs font-semibold text-slate-400 hover:text-primary transition-colors"
                                            >
                                                Edit
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            {pages > 1 && (
                <div className="flex items-center justify-center gap-4 mt-6">
                    <button
                        onClick={() => onPage(Math.max(1, page - 1))}
                        disabled={page === 1}
                        className="text-sm text-slate-500 hover:text-slate-800 disabled:opacity-40 transition-colors"
                    >
                        Previous
                    </button>
                    <span className="text-sm text-slate-600">Page {page} of {pages}</span>
                    <button
                        onClick={() => onPage(Math.min(pages, page + 1))}
                        disabled={page === pages}
                        className="text-sm text-slate-500 hover:text-slate-800 disabled:opacity-40 transition-colors"
                    >
                        Next
                    </button>
                </div>
            )}
        </div>
    )
}
