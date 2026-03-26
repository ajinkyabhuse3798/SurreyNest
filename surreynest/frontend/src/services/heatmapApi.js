/**
 * Heatmap API service, fetches aggregated sector data for NeighbourhoodPulse.
 */
import api from './api'

export const fetchHeatmapSectors = () => api.get('/api/heatmap/sectors')
