/**
 * Constants and helpers for safety-related pages.
 */
import {
    AlertTriangle, Volume2, Users, Lock, Pill, Car, ShoppingBag, AlertOctagon,
} from 'lucide-react'

export const CAT_META = {
    'violent-crime': { name: 'Violent Crime', color: '#ef4444', Icon: AlertTriangle },
    'anti-social-behaviour': { name: 'Noise & ASB', color: '#f59e0b', Icon: Volume2 },
    'public-order': { name: 'Public Order', color: '#8b5cf6', Icon: Users },
    'burglary': { name: 'Break-ins', color: '#3b82f6', Icon: Lock },
    'drugs': { name: 'Drug Offences', color: '#6366f1', Icon: Pill },
    'vehicle-crime': { name: 'Vehicle Crime', color: '#14b8a6', Icon: Car },
    'theft-from-the-person': { name: 'Personal Theft', color: '#ec4899', Icon: ShoppingBag },
    'robbery': { name: 'Robbery', color: '#f97316', Icon: AlertOctagon },
}

export const TRAIN_STATIONS = [
    { name: 'Guildford Station', lat: 51.2370, lng: -0.5810, lines: 'South Western Railway, London Waterloo in ~35 min' },
    { name: 'London Road (Guildford)', lat: 51.2415, lng: -0.5700, lines: 'South Western Railway, local services' },
]
