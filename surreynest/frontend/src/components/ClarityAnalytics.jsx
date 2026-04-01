import React from 'react'
import { useLocation } from 'react-router-dom'
import { ensureClarityLoaded, setClarityRouteTag } from '../services/clarity'

export default function ClarityAnalytics() {
    const location = useLocation()

    React.useEffect(() => {
        ensureClarityLoaded()
        setClarityRouteTag(`${location.pathname || '/'}${location.search || ''}`)
    }, [location.pathname, location.search])

    return null
}
