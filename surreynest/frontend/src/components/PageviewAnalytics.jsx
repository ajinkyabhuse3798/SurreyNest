import React from 'react'
import { useLocation } from 'react-router-dom'
import { ensurePageviewAnalyticsLoaded } from '../services/analytics'

export default function PageviewAnalytics() {
    const location = useLocation()

    React.useEffect(() => {
        ensurePageviewAnalyticsLoaded()
    }, [location.pathname, location.search])

    return null
}
