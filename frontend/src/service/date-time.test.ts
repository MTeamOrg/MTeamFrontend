import { afterEach, describe, expect, it, vi } from 'vitest'
import { formatDateTime, formatTime } from './date-time'

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('formatDateTime (Buenos Aires, 24 hours, four-digit year)', () => {
  it.each([
    ['the last second before midnight', '2036-03-04T02:59:59.999Z', '03/03/2036 23:59'],
    ['midnight, which is never written as 24:00', '2036-03-04T03:00:00.000Z', '04/03/2036 00:00'],
    ['the end of a month', '2036-04-01T02:30:00.000Z', '31/03/2036 23:30'],
    ['the end of a year', '2037-01-01T02:59:00.000Z', '31/12/2036 23:59'],
    ['the start of a year', '2037-01-01T03:00:00.000Z', '01/01/2037 00:00'],
    ['a leap day', '2036-03-01T02:30:00.000Z', '29/02/2036 23:30'],
    ['noon', '2036-06-15T15:00:00.000Z', '15/06/2036 12:00'],
    ['a single digit day, month and minute', '2036-02-05T13:05:00.000Z', '05/02/2036 10:05'],
  ])('renders %s', (_label, instant, expected) => {
    expect(formatDateTime(instant)).toBe(expected)
  })

  it('never shows a 12-hour clock or a two-digit year', () => {
    for (const instant of ['2036-06-15T22:05:00.000Z', '2036-06-15T03:05:00.000Z', '2036-06-15T15:00:00.000Z']) {
      expect(formatDateTime(instant)).toMatch(/^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}$/)
      expect(formatDateTime(instant)).not.toMatch(/[ap]\. ?m\./i)
    }
  })

  it('shows the same day and time the backend writes in its notification texts', () => {
    // The backend stores "Tu cuota vence el 03/03/2036 a las 23:30." for this instant.
    expect(formatDateTime('2036-03-04T02:30:00.000Z')).toBe('03/03/2036 23:30')
  })

  it.each(['UTC', 'Asia/Tokyo', 'Pacific/Kiritimati', 'America/Los_Angeles', 'America/Argentina/Buenos_Aires'])(
    'does not depend on the time zone of the browser (%s)',
    (timeZone) => {
      vi.stubEnv('TZ', timeZone)
      expect(formatDateTime('2036-03-04T02:30:00.000Z')).toBe('03/03/2036 23:30')
      expect(formatTime('2036-03-04T02:30:00.000Z')).toBe('23:30')
    },
  )
})

describe('formatTime', () => {
  it('uses a 24-hour clock', () => {
    expect(formatTime('2036-06-15T22:05:00.000Z')).toBe('19:05')
    expect(formatTime('2036-06-15T03:05:00.000Z')).toBe('00:05')
  })
})
