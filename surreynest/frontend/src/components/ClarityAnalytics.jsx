import React from 'react'
import { useLocation } from 'react-router-dom'
import {
    applyClarityConsent,
    ensureClarityLoaded,
    readAnalyticsConsent,
    setClarityRouteTag,
} from '../services/clarity'

export default function ClarityAnalytics() {
    const location = useLocation()

    React.useEffect(() => {
        ensureClarityLoaded()
        applyClarityConsent(readAnalyticsConsent())
        setClarityRouteTag(`${location.pathname || '/'}${location.search || ''}`)
    }, [location.pathname, location.search])

    return null
}
