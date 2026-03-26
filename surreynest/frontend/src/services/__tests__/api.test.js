import { describe, expect, it } from 'vitest'

import { AppError } from '../api'

describe('AppError', () => {
    it('keeps an axios-style response shape for existing UI error handlers', () => {
        const error = new AppError(
            'Invalid request, please check your input.',
            400,
            'Server-side validation failed.',
        )

        expect(error.status).toBe(400)
        expect(error.detail).toBe('Server-side validation failed.')
        expect(error.response).toEqual({
            status: 400,
            data: { detail: 'Server-side validation failed.' },
        })
    })
})
