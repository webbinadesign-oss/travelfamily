/**
 * Shared domain types for Webbina Travel AI services.
 * These are the contracts the API routes speak in.
 */

/* ── Common ───────────────────────────────────────────────── */
export interface GeoPoint {
  lat: number;
  lng: number;
}

export type Currency = string; // ISO 4217, e.g. "EUR"

export interface Money {
  amount: number;
  currency: Currency;
}

export interface Paginated<T> {
  items: T[];
  total: number;
}

/* ── Webbina conversation (OpenAI brain) ──────────────────── */
export type WebbinaEmotion =
  | 'neutral'
  | 'happy'
  | 'focused'
  | 'reassuring'
  | 'surprised'
  | 'enthusiastic';

export type ChatRole = 'system' | 'user' | 'assistant';

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface ChatRequest {
  /** Full prior turn history (without the system prompt). */
  messages: ChatMessage[];
  /** Optional structured trip context to ground the answer. */
  context?: TripContext;
  /** Stream tokens via SSE instead of a single JSON response. */
  stream?: boolean;
}

export interface TripContext {
  origin?: string;
  destination?: string;
  startDate?: string;
  endDate?: string;
  adults?: number;
  children?: number;
  childrenAges?: number[];
  budget?: Money;
  interests?: string[];
}

export interface ChatResponse {
  reply: string;
  emotion: WebbinaEmotion;
  /** Short tappable follow-up suggestions for the UI. */
  suggestions: string[];
  /** Optional machine-readable intent the frontend can act on. */
  action?: WebbinaAction;
}

export type WebbinaAction =
  | { type: 'search_flights'; query: FlightSearchQuery }
  | { type: 'search_hotels'; cityCode: string; checkIn: string; checkOut: string; adults: number }
  | { type: 'show_weather'; place: string }
  | { type: 'show_formalities'; destination: string }
  | { type: 'none' };

/* ── ElevenLabs (voice) ───────────────────────────────────── */
export interface TtsRequest {
  text: string;
  voiceId?: string;
  modelId?: string;
  /** 0..1 expressive style, mapped from Webbina's emotion. */
  style?: number;
  format?: 'mp3_44100_128' | 'pcm_16000';
}

export interface SignedAgentUrl {
  signedUrl: string;
  agentId: string;
  expiresInSeconds: number;
}

/* ── Amadeus (flights & hotels) ───────────────────────────── */
export interface FlightSearchQuery {
  origin: string; // IATA, e.g. "PAR"
  destination: string; // IATA, e.g. "DPS"
  departureDate: string; // YYYY-MM-DD
  returnDate?: string;
  adults: number;
  children?: number;
  infants?: number;
  travelClass?: 'ECONOMY' | 'PREMIUM_ECONOMY' | 'BUSINESS' | 'FIRST';
  nonStop?: boolean;
  currencyCode?: Currency;
  maxResults?: number;
}

export interface FlightSegment {
  from: string;
  to: string;
  departureAt: string;
  arrivalAt: string;
  carrierCode: string;
  flightNumber: string;
  durationIso: string;
}

export interface FlightOffer {
  id: string;
  price: Money;
  oneWay: boolean;
  stops: number;
  durationIso: string;
  segments: FlightSegment[];
  bookableSeats?: number;
}

export interface HotelSearchQuery {
  cityCode?: string; // IATA city, e.g. "PAR" (Amadeus path)
  lat?: number;      // geographic search (Duffel Stays path)
  lng?: number;
  checkInDate: string;
  checkOutDate: string;
  adults: number;
  children?: number;
  roomQuantity?: number;
  radiusKm?: number;
  currencyCode?: Currency;
}

export interface HotelOffer {
  hotelId: string;
  name: string;
  rating?: number;
  reviewScore?: number;
  geo?: GeoPoint;
  price: Money;
  perNight?: boolean;
  boardType?: string;
  photoUrl?: string;
  available: boolean;
}

/* ── Google Maps (places) ─────────────────────────────────── */
export interface PlaceSearchQuery {
  query: string;
  near?: GeoPoint;
  radiusKm?: number;
  language?: string;
}

export interface Place {
  id: string;
  name: string;
  address: string;
  location: GeoPoint;
  rating?: number;
  userRatingsTotal?: number;
  types: string[];
  photoUrl?: string;
}

/* ── Weather (OpenWeather) ────────────────────────────────── */
export interface WeatherQuery {
  lat: number;
  lng: number;
  lang?: string;
  units?: 'metric' | 'imperial';
}

export interface WeatherNow {
  tempC: number;
  feelsLikeC: number;
  condition: string;
  icon: string;
  humidity: number;
  windKmh: number;
}

export interface ForecastDay {
  date: string;
  minC: number;
  maxC: number;
  condition: string;
  icon: string;
}

export interface WeatherResult {
  place: string;
  now: WeatherNow;
  daily: ForecastDay[];
}
