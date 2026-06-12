/**
 * Webbina Memory — domain types (shared contracts for the memory API).
 */
import type { Money } from './index.js';

export type CabinClass = 'ECONOMY' | 'PREMIUM_ECONOMY' | 'BUSINESS' | 'FIRST';
export type TripStatus = 'idea' | 'quote' | 'booked' | 'completed' | 'cancelled';
export type TravelPace = 'relaxed' | 'balanced' | 'intense';

export interface UserRecord {
  id: string;
  email: string;
  fullName?: string;
  locale: string;
}

export interface TravelProfile {
  userId: string;
  homeAirport?: string;
  homeCity?: string;
  preferredCabin?: CabinClass;
  preferredAirlines: string[];
  typicalBudget?: number;
  budgetCurrency: string;
  pace?: TravelPace;
  preferenceSummary?: string;
  summaryUpdatedAt?: string;
}

export interface Traveler {
  id: string;
  userId: string;
  fullName: string;
  relation?: string;
  birthdate?: string;
  isDefault: boolean;
  notes?: string;
}

export interface Passport {
  id: string;
  userId: string;
  travelerId?: string;
  holderName: string;
  nationality: string;
  numberLast4?: string;
  issuedOn?: string;
  expiresOn: string;
}

export interface TripPreferences {
  userId: string;
  interests: string[];
  climates: string[];
  avoid: string[];
  travelsWithChildren: boolean;
  accessibility: string[];
  dietary: string[];
}

export interface SavedTrip {
  id: string;
  userId: string;
  title: string;
  destination?: string;
  country?: string;
  startDate?: string;
  endDate?: string;
  status: TripStatus;
  budget?: Money;
  travelersCount?: number;
  summary?: string;
  coverUrl?: string;
  createdAt: string;
}

export interface ConversationEntry {
  id?: string;
  userId: string;
  sessionId?: string;
  kind?: 'message' | 'fact' | 'summary';
  role?: 'user' | 'assistant' | 'system';
  content: string;
  emotion?: string;
  importance?: number;
  createdAt?: string;
}

/** Everything Webbina needs to greet a returning user with context. */
export interface MemoryContext {
  user?: UserRecord;
  profile?: TravelProfile;
  preferences?: TripPreferences;
  travelers: Traveler[];
  passports: Passport[];
  recentTrips: SavedTrip[];
  /** Natural-language summary (auto-generated). */
  summary: string;
  /** A ready-to-speak greeting that reuses the context. */
  greeting: string;
  /** True if there is enough history to personalise. */
  returning: boolean;
}
