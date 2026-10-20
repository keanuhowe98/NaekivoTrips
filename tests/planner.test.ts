import test from 'node:test'
import assert from 'node:assert/strict'
import { cloneAppData, createTrip, dayCost, formatMoney, getScheduleWarnings, getSuggestions, makeActivity, places, sampleData, tripCost, validateAppData } from '../src/model.ts'
import type { Activity, TripInput } from '../src/model.ts'

const input: TripInput = {
  title: 'Tokyo in spring', destination: 'Tokyo', startDate: '2027-03-12', endDate: '2027-03-14',
  travelers: 2, budget: 1200, interests: ['Culture'], stepFree: true, pace: 'balanced',
}
const activity = (overrides: Partial<Activity> = {}): Activity => ({ ...makeActivity(places[0]), ...overrides })

test('custom destination creates dated, empty days without fabricated discovery', () => {
  const trip = createTrip(input)
  assert.deepEqual(trip.days.map(day => day.date), ['2027-03-12', '2027-03-13', '2027-03-14'])
  assert.ok(trip.days.every(day => day.activities.length === 0))
  assert.equal(tripCost(trip), 0)
  assert.deepEqual(getSuggestions(trip, 0, 'rain'), [])
  trip.interests.push('Food')
  assert.deepEqual(input.interests, ['Culture'])
})

test('trip day enumeration is stable through daylight-saving transitions and leap days', () => {
  assert.deepEqual(createTrip({ ...input, startDate: '2027-03-13', endDate: '2027-03-15' }).days.map(day => day.date), ['2027-03-13', '2027-03-14', '2027-03-15'])
  assert.deepEqual(createTrip({ ...input, startDate: '2028-02-28', endDate: '2028-03-01' }).days.map(day => day.date), ['2028-02-28', '2028-02-29', '2028-03-01'])
})

test('creation rejects invalid dates, reversed ranges, and more than 30 inclusive days', () => {
  assert.throws(() => createTrip({ ...input, startDate: '2027-02-29' }), /valid start/)
  assert.throws(() => createTrip({ ...input, endDate: '2027-03-11' }), /on or after/)
  assert.equal(createTrip({ ...input, startDate: '2027-01-01', endDate: '2027-01-30' }).days.length, 30)
  assert.throws(() => createTrip({ ...input, startDate: '2027-01-01', endDate: '2027-01-31' }), /30 days/)
})

test('budget and traveler validation prevent invalid numeric planning values', () => {
  for (const budget of [-1, NaN, Infinity, 1_000_001]) assert.throws(() => createTrip({ ...input, budget }), /budget/)
  for (const travelers of [0, 21, 1.5, NaN]) assert.throws(() => createTrip({ ...input, travelers }), /travelers/)
  assert.equal(createTrip({ ...input, budget: 0 }).budget, 0)
  assert.equal(createTrip({ ...input, budget: 20.126 }).budget, 20.13)
})

test('costs sum total party estimates without multiplying by travelers again', () => {
  assert.equal(tripCost(sampleData.trips[0]), 540)
  assert.equal(dayCost(sampleData.trips[0].days[0]), 180)
  assert.equal(dayCost([activity({ cost: .1 }), activity({ cost: .2 })]), .3)
  assert.equal(formatMoney(1600), '$1,600')
  assert.equal(formatMoney(10.5), '$10.50')
})

test('schedule detects travel gaps, nested overlaps, and midnight without mutating order', () => {
  const activities = [
    activity({ id: 'later', title: 'Lunch', time: '11:00', duration: 30, travelMinutes: 15 }),
    activity({ id: 'long', title: 'Long tour', time: '09:00', duration: 180, travelMinutes: 0 }),
    activity({ id: 'short', title: 'Coffee', time: '09:30', duration: 15, travelMinutes: 0 }),
    activity({ id: 'night', title: 'Night walk', time: '23:30', duration: 60, travelMinutes: 0 }),
  ]
  const before = structuredClone(activities)
  const warnings = getScheduleWarnings(activities)
  assert.equal(warnings.filter(warning => warning.includes('overlap')).length, 2)
  assert.ok(warnings.some(warning => warning.includes('past midnight')))
  assert.deepEqual(activities, before)
  assert.deepEqual(getScheduleWarnings([activity({ time: '09:00', duration: 60, travelMinutes: 0 }), activity({ time: '10:15', duration: 30, travelMinutes: 15 })]), [])
  assert.equal(getScheduleWarnings([activity({ time: '09:00', duration: 60, travelMinutes: 0 }), activity({ time: '10:10', travelMinutes: 15 })]).length, 1)
})

test('scenario suggestions preserve the schedule and require explicit application', () => {
  const trip = cloneAppData(sampleData).trips[0]
  const before = structuredClone(trip)
  const suggestions = getSuggestions(trip, 0, 'rain')
  assert.ok(suggestions.length > 0)
  assert.deepEqual(trip, before)
  for (const suggestion of suggestions) {
    const original = trip.days[0].activities.find(item => item.id === suggestion.activityId)!
    assert.equal(suggestion.replacement.id, original.id)
    assert.equal(suggestion.replacement.time, original.time)
    assert.ok(suggestion.replacement.duration <= original.duration)
    assert.equal(suggestion.replacement.indoor, true)
    assert.match(suggestion.reason, /scenario/)
  }
  assert.deepEqual(getSuggestions(trip, 0, 'clear'), [])
  assert.deepEqual(getSuggestions(trip, -1, 'rain'), [])
  assert.deepEqual(getSuggestions(trip, 100, 'rain'), [])
})

test('replanning respects aggregate budget, step-free preferences, completed items, and destination scope', () => {
  const trip = createTrip({ ...input, destination: 'Destin', budget: 100, stepFree: true })
  trip.days[0].activities = [activity({ id: 'a', time: '09:00' }), activity({ id: 'b', time: '13:00' }), activity({ id: 'c', time: '16:00', done: true })]
  const suggestions = getSuggestions(trip, 0, 'heat')
  assert.ok(suggestions.length > 0)
  assert.ok(suggestions.every(item => item.replacement.stepFree && item.activityId !== 'c'))
  const combinedCost = suggestions.reduce((sum, item) => sum + item.replacement.cost, 0)
  assert.ok(combinedCost <= 100)
  trip.budget = 0
  assert.deepEqual(getSuggestions(trip, 0, 'heat'), [])
  trip.budget = 1000
  trip.destination = 'Tokyo'
  assert.deepEqual(getSuggestions(trip, 0, 'heat'), [])
})

test('interests rank matching alternatives and pace distinguishes lingering from shorter visits', () => {
  const trip = createTrip({ ...input, destination: 'Destin', budget: 1000, interests: ['Food & drink'], pace: 'relaxed' })
  trip.days[0].activities = [activity({ id: 'outdoors', duration: 90 })]
  const relaxed = getSuggestions(trip, 0, 'rain')[0]
  assert.equal(relaxed.replacement.category, 'food')
  assert.equal(relaxed.replacement.duration, 90)
  assert.match(relaxed.reason, /matches your interests/)
  trip.pace = 'full'
  const full = getSuggestions(trip, 0, 'rain')[0]
  assert.equal(full.replacement.category, 'food')
  assert.equal(full.replacement.duration, 60)
  trip.interests = ['Culture']
  assert.equal(getSuggestions(trip, 0, 'rain')[0].replacement.category, 'culture')
})

test('default sample day has a useful rainy-day swap with no introduced conflicts', () => {
  const trip = cloneAppData(sampleData).trips[0]
  const suggestions = getSuggestions(trip, 0, 'rain')
  assert.ok(suggestions.length > 0)
  const replacements = new Map(suggestions.map(item => [item.activityId, item.replacement]))
  trip.days[0].activities = trip.days[0].activities.map(item => replacements.get(item.id) ?? item)
  assert.deepEqual(getScheduleWarnings(trip.days[0].activities), [])
  assert.ok(tripCost(trip) <= trip.budget)
  assert.ok(validateAppData({ ...cloneAppData(sampleData), trips: [trip] }))
})

test('each suggestion is affordable independently of any other unaccepted savings', () => {
  const trip = createTrip({ ...input, destination: 'Destin', budget: 100, interests: ['Culture'] })
  trip.days[0].activities = [
    activity({ id: 'paid-outdoor', time: '09:00', cost: 100 }),
    activity({ id: 'free-outdoor', time: '14:00', cost: 0 }),
  ]
  for (const suggestion of getSuggestions(trip, 0, 'rain')) {
    const original = trip.days[0].activities.find(item => item.id === suggestion.activityId)!
    assert.ok(tripCost(trip) - original.cost + suggestion.replacement.cost <= trip.budget)
  }
  assert.equal(getSuggestions(trip, 0, 'rain').length, 1)
})

test('valid exports round-trip, and clones share no mutable arrays or preferences', () => {
  assert.equal(validateAppData(sampleData), true)
  assert.equal(validateAppData(JSON.parse(JSON.stringify(sampleData))), true)
  const cloned = cloneAppData(sampleData)
  cloned.trips[0].days[0].activities[0].title = 'Changed'
  cloned.preferences.name = 'Different'
  cloned.savedPlaceIds.length = 0
  assert.notEqual(sampleData.trips[0].days[0].activities[0].title, 'Changed')
  assert.notEqual(sampleData.preferences.name, 'Different')
  assert.equal(sampleData.savedPlaceIds.length, 2)
})

test('import validation rejects hostile keys, remote image requests, wrong types, and non-finite costs', () => {
  for (const hostile of [null, [], {}, 'data', JSON.parse('{"__proto__":{"polluted":true}}')]) assert.equal(validateAppData(hostile), false)
  const changes: ((data: any) => void)[] = [
    data => { data.trips[0].days[0].activities[0].cost = NaN },
    data => { data.trips[0].days[0].activities[0].image = 'https://tracking.example/pixel' },
    data => { data.trips[0].days[0].activities[0].time = '25:00' },
    data => { data.trips[0].days[0].activities[0].duration = -1 },
    data => { data.preferences.largeText = 'true' },
    data => { data.preferences.constructor = {} },
    data => { data.trips[0].days[0].activities[0].notes = 'x'.repeat(4001) },
  ]
  for (const change of changes) {
    const data = cloneAppData(sampleData)
    change(data)
    assert.equal(validateAppData(data), false)
  }
  const hostile = JSON.parse(JSON.stringify(sampleData))
  Object.defineProperty(hostile.preferences, '__proto__', { value: { polluted: true }, enumerable: true })
  assert.equal(validateAppData(hostile), false)
  assert.equal(({} as any).polluted, undefined)
})

test('import validation enforces unique IDs and exact consecutive date coverage', () => {
  const duplicateTrip = cloneAppData(sampleData)
  duplicateTrip.trips.push(structuredClone(duplicateTrip.trips[0]))
  assert.equal(validateAppData(duplicateTrip), false)
  const duplicateActivity = cloneAppData(sampleData)
  duplicateActivity.trips[0].days[1].activities[0].id = duplicateActivity.trips[0].days[0].activities[0].id
  assert.equal(validateAppData(duplicateActivity), false)
  const missingDay = cloneAppData(sampleData)
  missingDay.trips[0].days.pop()
  assert.equal(validateAppData(missingDay), false)
  const wrongDate = cloneAppData(sampleData)
  wrongDate.trips[0].days[1].date = '2026-10-26'
  assert.equal(validateAppData(wrongDate), false)
})
