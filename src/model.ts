export type Category = 'food' | 'nature' | 'culture' | 'relaxation' | 'transport'

export interface Activity {
  id: string
  title: string
  category: Category
  time: string
  duration: number
  cost: number
  /** Estimated journey time immediately before this activity. */
  travelMinutes: number
  indoor: boolean
  /** Planning assumption only; access must be checked with the venue. */
  stepFree: boolean
  notes?: string
  image?: string
  done?: boolean
}

export interface TripDay { date: string; activities: Activity[] }

export interface Trip {
  id: string
  title: string
  destination: string
  startDate: string
  endDate: string
  travelers: number
  budget: number
  interests: string[]
  stepFree: boolean
  pace: 'relaxed' | 'balanced' | 'full'
  days: TripDay[]
  isSample?: boolean
}

export interface AppData {
  trips: Trip[]
  savedPlaceIds: string[]
  preferences: { name: string; largeText: boolean; highContrast: boolean }
}

export interface Place {
  id: string
  title: string
  area: string
  category: Category
  image: string
  /** Total estimate for two travelers, not a quote or admission price. */
  cost: number
  duration: number
  indoor: boolean
  stepFree: boolean
  description: string
}

export type TripInput = Omit<Trip, 'id' | 'days' | 'isSample'>
export interface Suggestion {
  id: string
  title: string
  reason: string
  activityId: string
  replacement: Activity
}

export const places: Place[] = [
  {
    id: 'shoreline-walk', title: 'A slow morning by the water', area: 'Destin shoreline',
    category: 'nature', image: '/images/beach.jpg', cost: 0, duration: 90,
    indoor: false, stepFree: false,
    description: 'An unhurried stretch of sand and emerald water. A conceptual outing; choose a public access point and check surf, parking, and beach access locally.',
  },
  {
    id: 'harbor-cafe', title: 'Coffee & a coastal breakfast', area: 'Destin harbor area',
    category: 'food', image: '/images/town.jpg', cost: 48, duration: 60,
    indoor: true, stepFree: true,
    description: 'Find a cozy indoor café near the harbor. $48 is a total estimate for two; indoor seating and step-free access are planning assumptions to confirm.',
  },
  {
    id: 'seaside-picnic', title: 'A picnic with a sea view', area: '30A coast',
    category: 'food', image: '/images/coast.jpg', cost: 54, duration: 90,
    indoor: false, stepFree: false,
    description: 'Pick up lunch and find a public picnic spot along the coast. Allow about $54 for two and check access, shade, parking, and local rules before setting out.',
  },
  {
    id: 'coastal-gallery', title: 'Art, a little closer to home', area: '30A village area',
    category: 'culture', image: '/images/town.jpg', cost: 36, duration: 75,
    indoor: true, stepFree: true,
    description: 'A relaxed browse through a local gallery or art space. $36 is an outing allowance for two, not a ticket price. Hours and step-free entry need confirmation.',
  },
  {
    id: 'waterfront-dinner', title: 'Dinner as the coast slows down', area: 'Destin waterfront area',
    category: 'food', image: '/images/coast.jpg', cost: 132, duration: 90,
    indoor: true, stepFree: true,
    description: 'Choose a waterfront restaurant with indoor seating. Allow about $132 total for two. Reservations, availability, and step-free access are not verified.',
  },
  {
    id: 'village-stroll', title: 'Little streets, lovely discoveries', area: '30A village area',
    category: 'culture', image: '/images/town.jpg', cost: 0, duration: 90,
    indoor: false, stepFree: true,
    description: 'Explore the shops and public spaces of a coastal village. This is a route idea, not a verified accessible route; check sidewalks, crossings, and parking first.',
  },
]

const categories: Category[] = ['food', 'nature', 'culture', 'relaxation', 'transport']
const paces = ['relaxed', 'balanced', 'full']
const dayMs = 86_400_000
const maxDays = 30
const validTime = (value: unknown): value is string => typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value)
const textValue = (value: unknown, max: number, empty = false): value is string =>
  typeof value === 'string' && value.length <= max && (empty || value.trim().length > 0) && !/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(value)
const numberValue = (value: unknown, min: number, max: number, integer = false): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max && (!integer || Number.isInteger(value))

function dateTimestamp(value: unknown): number | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const stamp = Date.parse(`${value}T12:00:00.000Z`)
  if (!Number.isFinite(stamp) || new Date(stamp).toISOString().slice(0, 10) !== value) return null
  return stamp
}

function datesBetween(startDate: string, endDate: string): string[] {
  const start = dateTimestamp(startDate)
  const end = dateTimestamp(endDate)
  if (start === null || end === null) throw new Error('Enter valid start and end dates.')
  const count = Math.round((end - start) / dayMs) + 1
  if (count < 1) throw new Error('The end date must be on or after the start date.')
  if (count > maxDays) throw new Error('Trips can include up to 30 days.')
  return Array.from({ length: count }, (_, index) => new Date(start + index * dayMs).toISOString().slice(0, 10))
}

function newId(prefix: string): string {
  return `${prefix}-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`}`
}

export function createTrip(input: TripInput): Trip {
  if (!textValue(input.title, 120)) throw new Error('Give your trip a name of up to 120 characters.')
  if (!textValue(input.destination, 120)) throw new Error('Enter a destination of up to 120 characters.')
  if (!numberValue(input.travelers, 1, 20, true)) throw new Error('Choose between 1 and 20 travelers.')
  if (!numberValue(input.budget, 0, 1_000_000)) throw new Error('Enter a budget between $0 and $1,000,000.')
  if (!Array.isArray(input.interests) || input.interests.length > 12 || !input.interests.every(item => textValue(item, 80))) throw new Error('Choose up to 12 interests.')
  if (typeof input.stepFree !== 'boolean' || !paces.includes(input.pace)) throw new Error('Choose valid access and pace preferences.')
  const dates = datesBetween(input.startDate, input.endDate)
  return {
    id: newId('trip'), title: input.title.trim(), destination: input.destination.trim(),
    startDate: input.startDate, endDate: input.endDate, travelers: input.travelers,
    budget: Math.round(input.budget * 100) / 100, interests: [...new Set(input.interests.map(item => item.trim()))],
    stepFree: input.stepFree, pace: input.pace,
    days: dates.map(date => ({ date, activities: [] })),
  }
}

export function dayCost(day: TripDay | Activity[]): number {
  const activities = Array.isArray(day) ? day : day.activities
  return Math.round(activities.reduce((sum, activity) => sum + activity.cost, 0) * 100) / 100
}

export function tripCost(trip: Trip): number {
  return Math.round(trip.days.reduce((sum, day) => sum + dayCost(day), 0) * 100) / 100
}

export function formatMoney(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: Number.isInteger(amount) ? 0 : 2 }).format(amount)
}

export function makeActivity(place: Place): Activity {
  return {
    id: newId('activity'), title: place.title, category: place.category, time: '09:00',
    duration: place.duration, cost: place.cost, travelMinutes: 15,
    indoor: place.indoor, stepFree: place.stepFree, notes: place.description, image: place.image,
  }
}

export function getScheduleWarnings(activities: Activity[]): string[] {
  const warnings: string[] = []
  const sorted = activities.filter(activity => {
    if (!validTime(activity.time) || !numberValue(activity.duration, 1, 1440, true) || !numberValue(activity.travelMinutes, 0, 1440, true)) {
      warnings.push(`Check the time and duration for “${activity.title}”.`)
      return false
    }
    return true
  }).map(activity => {
    const [hours, minutes] = activity.time.split(':').map(Number)
    return { activity, start: hours * 60 + minutes, end: hours * 60 + minutes + activity.duration }
  }).sort((a, b) => a.start - b.start)
  let latest: typeof sorted[number] | undefined
  for (const current of sorted) {
    if (current.end > 1440) warnings.push(`“${current.activity.title}” runs past midnight. Move it earlier or shorten it.`)
    if (current.start - current.activity.travelMinutes < 0) warnings.push(`Travel to “${current.activity.title}” begins on the previous day.`)
    if (latest && current.start - current.activity.travelMinutes < latest.end) {
      warnings.push(`“${latest.activity.title}” and “${current.activity.title}” overlap when travel time is included.`)
    }
    if (!latest || current.end > latest.end) latest = current
  }
  return warnings
}

function preferredCategories(interests: string[]): Set<Category> {
  const preferred = new Set<Category>()
  for (const interest of interests) {
    const normalized = interest.toLowerCase()
    if (/food|drink|dining|coffee/.test(normalized)) preferred.add('food')
    if (/nature|outdoor|adventure/.test(normalized)) preferred.add('nature')
    if (/culture|art|history/.test(normalized)) preferred.add('culture')
    if (/relax|wellness|slow/.test(normalized)) preferred.add('relaxation')
    if (/transport|travel/.test(normalized)) preferred.add('transport')
  }
  return preferred
}

/** Local example suggestions, never a live forecast or a verified venue recommendation. */
export function getSuggestions(trip: Trip, dayIndex: number, condition: 'clear' | 'rain' | 'heat'): Suggestion[] {
  if (condition === 'clear' || !['rain', 'heat'].includes(condition) || !Number.isInteger(dayIndex)) return []
  if (!/\b(destin|30a|emerald coast|santa rosa beach|fort walton beach)\b/i.test(trip.destination)) return []
  const day = trip.days[dayIndex]
  if (!day) return []
  const suggestions: Suggestion[] = []
  const usedTitles = new Set(day.activities.map(activity => activity.title))
  const availableBudget = Math.max(0, trip.budget - tripCost(trip))
  const preferred = preferredCategories(trip.interests)
  const paceMinutes = { relaxed: 90, balanced: 75, full: 60 }[trip.pace]
  let proposedIncrease = 0
  for (const activity of day.activities) {
    if (activity.indoor || activity.done || activity.category === 'transport') continue
    const options = places.filter(place => place.indoor && (!trip.stepFree || place.stepFree) && !usedTitles.has(place.title))
      .map(place => ({ place, cost: Math.round(place.cost * trip.travelers / 2 * 100) / 100 }))
      .filter(({ cost }) => cost - activity.cost + proposedIncrease <= availableBudget)
      .sort((a, b) => Number(preferred.has(b.place.category)) - Number(preferred.has(a.place.category))
        || Number(b.place.category === activity.category) - Number(a.place.category === activity.category)
        || Math.abs(a.place.duration - Math.min(activity.duration, paceMinutes)) - Math.abs(b.place.duration - Math.min(activity.duration, paceMinutes))
        || a.cost - b.cost)
    const option = options[0]
    if (!option) continue
    const replacement = {
      ...makeActivity(option.place), id: activity.id, time: activity.time,
      duration: Math.min(option.place.duration, activity.duration), travelMinutes: activity.travelMinutes,
      cost: option.cost,
    }
    usedTitles.add(option.place.title)
    // Each card can be applied independently; another unaccepted swap cannot fund it.
    proposedIncrease += Math.max(0, replacement.cost - activity.cost)
    suggestions.push({
      id: `${condition}-${activity.id}-${option.place.id}`,
      title: `Try ${option.place.title.toLowerCase()}`,
      reason: `${condition === 'rain' ? 'For your rainy-day scenario' : 'For your hot-day scenario'}, this indoor idea keeps your start time${preferred.has(option.place.category) ? ' and matches your interests' : ''}. ${tripCost(trip) > trip.budget ? 'It does not increase your planned spending' : 'It fits your estimated budget'}; your ${trip.pace} pace helped rank the options. Confirm the venue, hours${trip.stepFree ? ', and step-free access' : ''} before going.`,
      activityId: activity.id, replacement,
    })
    if (suggestions.length === 3) break
  }
  return suggestions
}

function plainRecord(value: unknown, allowed: string[], required: string[] = allowed): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  if (prototype !== Object.prototype && prototype !== null) return false
  const keys = Object.keys(value)
  return keys.every(key => allowed.includes(key)) && required.every(key => Object.hasOwn(value, key))
}

function validActivity(value: unknown): value is Activity {
  const required = ['id', 'title', 'category', 'time', 'duration', 'cost', 'travelMinutes', 'indoor', 'stepFree']
  if (!plainRecord(value, [...required, 'notes', 'image', 'done'], required)) return false
  return textValue(value.id, 100) && textValue(value.title, 160) && categories.includes(value.category as Category) && validTime(value.time)
    && numberValue(value.duration, 1, 1440, true) && numberValue(value.cost, 0, 1_000_000) && numberValue(value.travelMinutes, 0, 1440, true)
    && typeof value.indoor === 'boolean' && typeof value.stepFree === 'boolean'
    && (value.notes === undefined || textValue(value.notes, 4000, true))
    && (value.image === undefined || (typeof value.image === 'string' && /^\/images\/[a-zA-Z0-9_-]+\.(jpg|jpeg|png|webp|avif)$/.test(value.image)))
    && (value.done === undefined || typeof value.done === 'boolean')
}

function validTrip(value: unknown): value is Trip {
  const required = ['id', 'title', 'destination', 'startDate', 'endDate', 'travelers', 'budget', 'interests', 'stepFree', 'pace', 'days']
  if (!plainRecord(value, [...required, 'isSample'], required)) return false
  if (!textValue(value.id, 100) || !textValue(value.title, 120) || !textValue(value.destination, 120)
    || !numberValue(value.travelers, 1, 20, true) || !numberValue(value.budget, 0, 1_000_000)
    || !Array.isArray(value.interests) || value.interests.length > 12 || !value.interests.every(item => textValue(item, 80))
    || typeof value.stepFree !== 'boolean' || !paces.includes(value.pace as string)
    || (value.isSample !== undefined && typeof value.isSample !== 'boolean')
    || typeof value.startDate !== 'string' || typeof value.endDate !== 'string' || !Array.isArray(value.days)) return false
  const expectedDates = datesBetween(value.startDate, value.endDate)
  if (value.days.length !== expectedDates.length) return false
  const ids = new Set<string>()
  return value.days.every((day, index) => {
    if (!plainRecord(day, ['date', 'activities']) || day.date !== expectedDates[index] || !Array.isArray(day.activities) || day.activities.length > 64) return false
    return day.activities.every(activity => {
      if (!validActivity(activity) || ids.has(activity.id)) return false
      ids.add(activity.id)
      return true
    })
  })
}

/** Validate the entire import before replacing any existing local data. */
export function validateAppData(value: unknown): value is AppData {
  try {
    if (!plainRecord(value, ['trips', 'savedPlaceIds', 'preferences']) || !Array.isArray(value.trips) || value.trips.length > 100
      || !Array.isArray(value.savedPlaceIds) || value.savedPlaceIds.length > places.length
      || !value.savedPlaceIds.every(id => typeof id === 'string' && places.some(place => place.id === id))
      || new Set(value.savedPlaceIds).size !== value.savedPlaceIds.length
      || !plainRecord(value.preferences, ['name', 'largeText', 'highContrast'])
      || !textValue(value.preferences.name, 80, true) || typeof value.preferences.largeText !== 'boolean' || typeof value.preferences.highContrast !== 'boolean') return false
    const ids = new Set<string>()
    return value.trips.every(trip => {
      if (!validTrip(trip) || ids.has(trip.id)) return false
      ids.add(trip.id)
      return true
    })
  } catch {
    return false
  }
}

export function cloneAppData(data: AppData): AppData {
  return structuredClone(data)
}

function sampleActivity(placeId: string, id: string, time: string, overrides: Partial<Activity> = {}): Activity {
  const place = places.find(item => item.id === placeId)!
  return { ...makeActivity(place), id, time, ...overrides }
}

export const sampleData: AppData = {
  preferences: { name: 'Traveler', largeText: false, highContrast: false },
  savedPlaceIds: ['shoreline-walk', 'coastal-gallery'],
  trips: [{
    id: 'coastal-weekend', title: 'A little coastal escape', destination: 'Destin & 30A',
    startDate: '2026-10-23', endDate: '2026-10-25', travelers: 2, budget: 1600,
    interests: ['Food & drink', 'Nature', 'Culture'], stepFree: false, pace: 'relaxed', isSample: true,
    days: [
      { date: '2026-10-23', activities: [
        sampleActivity('harbor-cafe', 'fri-breakfast', '09:00', { travelMinutes: 10 }),
        sampleActivity('shoreline-walk', 'fri-beach', '10:30', { travelMinutes: 15 }),
        sampleActivity('waterfront-dinner', 'fri-dinner', '18:00', { travelMinutes: 20 }),
      ] },
      { date: '2026-10-24', activities: [
        sampleActivity('village-stroll', 'sat-village', '09:30', { travelMinutes: 30 }),
        sampleActivity('seaside-picnic', 'sat-picnic', '12:00'),
        sampleActivity('coastal-gallery', 'sat-gallery', '14:30'),
        sampleActivity('waterfront-dinner', 'sat-dinner', '18:30', { cost: 138, travelMinutes: 30 }),
      ] },
      { date: '2026-10-25', activities: [
        sampleActivity('harbor-cafe', 'sun-breakfast', '09:00', { travelMinutes: 10 }),
        sampleActivity('coastal-gallery', 'sun-gallery', '10:30'),
        sampleActivity('seaside-picnic', 'sun-picnic', '12:30', { cost: 48 }),
      ] },
    ],
  }],
}
