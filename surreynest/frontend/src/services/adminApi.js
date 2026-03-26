/**
 * Admin API service calls.
 * All endpoints require the user to have the 'admin' role.
 */
import api from './api'

export const getOverviewStats = () => api.get('/api/admin/stats/overview').then(res => res.data)
export const getSignupTrends = (days = 30) => api.get('/api/admin/stats/signups', { params: { days } }).then(res => res.data)
export const getUsers = (params) => api.get('/api/admin/users', { params }).then(res => res.data)
export const updateUser = (userId, data) => api.patch(`/api/admin/users/${userId}`, data).then(res => res.data)
export const getModerationQueue = (params) => api.get('/api/admin/reviews/queue', { params }).then(res => res.data)
export const approveReview = (reviewId) => api.post(`/api/admin/reviews/${reviewId}/approve`).then(res => res.data)
export const rejectReview = (reviewId) => api.post(`/api/admin/reviews/${reviewId}/reject`).then(res => res.data)
export const getPipelineStatus = () => api.get('/api/admin/pipelines/status').then(res => res.data)
export const triggerPipeline = (pipelineName) => api.post(`/api/admin/pipelines/${pipelineName}/trigger`).then(res => res.data)

export const adminApi = {
    getOverviewStats,
    getSignupTrends,
    getUsers,
    updateUser,
    getModerationQueue,
    approveReview,
    rejectReview,
    getPipelineStatus,
    triggerPipeline,
}

export default adminApi
