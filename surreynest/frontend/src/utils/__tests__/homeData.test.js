/**
 * Tests for POSTCODE_RE regex from homeData.
 */
import { describe, it, expect } from 'vitest'
import { POSTCODE_RE } from '../homeData'

describe('POSTCODE_RE', () => {
    const valid = [
        'GU2 7XH',
        'GU1 3SB',
        'SW1A 1AA',
        'EC1A 1BB',
        'gu2 7xh',     // lowercase
        'GU27XH',       // no space
    ]

    const invalid = [
        '',
        'GU',
        '12345',
        'ABCDEF',
        'GU2',          // incomplete
        'hello world',
    ]

    it.each(valid)('matches valid postcode: %s', (pc) => {
        expect(POSTCODE_RE.test(pc)).toBe(true)
    })

    it.each(invalid)('rejects invalid postcode: %s', (pc) => {
        expect(POSTCODE_RE.test(pc)).toBe(false)
    })
})
