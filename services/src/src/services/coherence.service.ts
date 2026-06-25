/**
 * Itinerary Coherence Engine (step 1).
 * Pure date/time logic — NO LLM — so timing is reliable.
 * Validates that the legs of a trip fit together:
 *   - all comparisons done on absolute timestamps (UTC), never local strings
 *   - overnight / J+1 arrivals detected
 *   - hotel nights aligned to the REAL arrival/departure dates
 *   - connection gaps between consecutive segments respect a minimum
 *     (wider when small children travel)
 *
 * It returns structured checks with a traffic-light status so Webbina can
 * speak them and the UI can show 🟢/🟡/🔴 — she never has to "guess" timing.
 */

export type Light = 'green' | 'orange' | 'red';

export interface Leg {
  /** 'flight' | 'train' | 'ferry' | 'car' | 'other' */
  mode: string;
  from?: string;
  to?: string;
  /** ISO 8601 WITH offset, e.g. "2026-07-10T23:50:00+02:00". */
  departure: string;
  /** ISO 8601 WITH offset. */
  arrival: string;
  label?: string;
}

export interface HotelStay {
  name?: string;
  /** YYYY-MM-DD */
  checkIn: string;
  /** YYYY-MM-DD */
  checkOut: string;
  /** IANA-ish offset minutes for the hotel's local day, optional. */
}

export interface CoherenceInput {
  legs: Leg[];
  hotel?: HotelStay;
  /** Travelling with children → wider safety margins. */
  hasYoungChildren?: boolean;
  /** Override minimum connection minutes per mode pair. */
  minConnectionMinutes?: number;
}

export interface CoherenceCheck {
  id: string;
  status: Light;
  title: string;
  detail: string;
}

export interface CoherenceResult {
  status: Light;          // worst of all checks
  checks: CoherenceCheck[];
  summary: string;        // one natural sentence Webbina can say
}

/* ── helpers ─────────────────────────────────────────────── */
const MS_MIN = 60_000;
const MS_DAY = 86_400_000;

function ms(iso: string): number {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : NaN;
}
/** Calendar date (UTC) as YYYY-MM-DD for night-counting. */
function dayUTC(iso: string): string {
  const d = new Date(ms(iso));
  return d.toISOString().slice(0, 10);
}
function diffMinutes(aIso: string, bIso: string): number {
  return Math.round((ms(bIso) - ms(aIso)) / MS_MIN);
}
function nightsBetween(checkIn: string, checkOut: string): number {
  return Math.round((Date.parse(checkOut + 'T00:00:00Z') - Date.parse(checkIn + 'T00:00:00Z')) / MS_DAY);
}
function fmtTime(iso: string): string {
  const d = new Date(ms(iso));
  return d.toUTCString().slice(17, 22) + ' (UTC)';
}
function worst(a: Light, b: Light): Light {
  const rank: Record<Light, number> = { green: 0, orange: 1, red: 2 };
  return rank[b] > rank[a] ? b : a;
}

/** Minimum sane connection time (minutes) between two consecutive legs. */
function minConnection(prevMode: string, nextMode: string, kids: boolean): number {
  const p = prevMode.toLowerCase(), n = nextMode.toLowerCase();
  let base: number;
  if (n === 'flight' && p === 'flight') base = 90;       // airport transfer/security
  else if (n === 'flight') base = 120;                    // ground → flight: check-in + security
  else if (p === 'flight') base = 60;                     // deplane + baggage
  else if (n === 'ferry' || p === 'ferry') base = 60;
  else base = 30;                                         // train↔train etc.
  if (kids) base += 30;                                   // family margin
  return base;
}

/* ── engine ──────────────────────────────────────────────── */
export function checkCoherence(input: CoherenceInput): CoherenceResult {
  const checks: CoherenceCheck[] = [];
  const kids = !!input.hasYoungChildren;
  const legs = (input.legs || []).filter((l) => l && l.departure && l.arrival);

  // 1) Each leg's arrival must be after its departure.
  legs.forEach((l, i) => {
    const dur = diffMinutes(l.departure, l.arrival);
    if (!Number.isFinite(dur)) {
      checks.push({ id: `leg${i}-dates`, status: 'red', title: 'Dates illisibles',
        detail: `Le trajet ${l.label || l.mode} a des horaires invalides.` });
    } else if (dur < 0) {
      checks.push({ id: `leg${i}-order`, status: 'red', title: 'Horaires incohérents',
        detail: `${l.label || l.mode} : l'arrivée est avant le départ.` });
    } else {
      // Overnight / J+1 detection.
      const sameDay = dayUTC(l.departure) === dayUTC(l.arrival);
      if (!sameDay) {
        const days = Math.round((Date.parse(dayUTC(l.arrival) + 'T00:00:00Z') - Date.parse(dayUTC(l.departure) + 'T00:00:00Z')) / MS_DAY);
        checks.push({ id: `leg${i}-overnight`, status: 'orange', title: 'Arrivée le lendemain (J+' + days + ')',
          detail: `${l.label || (l.from + '→' + l.to)} part le ${dayUTC(l.departure)} et arrive le ${dayUTC(l.arrival)}. La première nuit sur place est donc celle du ${dayUTC(l.arrival)}.` });
      }
    }
  });

  // 2) Connections between consecutive legs.
  for (let i = 1; i < legs.length; i++) {
    const prev = legs[i - 1]!, next = legs[i]!;
    const gap = diffMinutes(prev.arrival, next.departure);
    const need = input.minConnectionMinutes ?? minConnection(prev.mode, next.mode, kids);
    const where = next.from || prev.to || '';
    if (!Number.isFinite(gap)) continue;
    if (gap < 0) {
      checks.push({ id: `conn${i}`, status: 'red', title: 'Correspondance impossible',
        detail: `Le ${next.label || next.mode} part à ${fmtTime(next.departure)} mais le ${prev.label || prev.mode} arrive seulement à ${fmtTime(prev.arrival)}${where ? ' à ' + where : ''}. Il part avant votre arrivée.` });
    } else if (gap < need) {
      checks.push({ id: `conn${i}`, status: 'red', title: 'Correspondance trop courte',
        detail: `Seulement ${gap} min entre votre arrivée et le départ suivant${where ? ' à ' + where : ''}. Il en faut au moins ${need} min${kids ? ' (avec de jeunes enfants)' : ''}.` });
    } else if (gap < need + 30) {
      checks.push({ id: `conn${i}`, status: 'orange', title: 'Correspondance serrée',
        detail: `${gap} min de battement${where ? ' à ' + where : ''}. C'est jouable mais peu confortable${kids ? ' avec des enfants' : ''} — je vise plus large si possible.` });
    } else {
      checks.push({ id: `conn${i}`, status: 'green', title: 'Correspondance confortable',
        detail: `${gap} min de battement${where ? ' à ' + where : ''}, c'est parfait.` });
    }
  }

  // 3) Hotel nights aligned to the REAL arrival / departure dates.
  if (input.hotel && legs.length) {
    const arrival = legs[0]!.arrival;
    const lastDeparture = legs[legs.length - 1]!.departure;
    const realFirstNight = dayUTC(arrival);
    const h = input.hotel;
    const nights = nightsBetween(h.checkIn, h.checkOut);

    if (h.checkIn !== realFirstNight && Date.parse(h.checkIn) < Date.parse(realFirstNight)) {
      checks.push({ id: 'hotel-early', status: 'red', title: 'Nuit d\'hôtel payée pour rien',
        detail: `L'hôtel est réservé à partir du ${h.checkIn}, mais vous arrivez seulement le ${realFirstNight}. Vous paieriez une nuit avant d'être là — je cale l'arrivée au ${realFirstNight}.` });
    } else if (Date.parse(h.checkIn) > Date.parse(realFirstNight)) {
      checks.push({ id: 'hotel-late', status: 'red', title: 'Pas d\'hôtel le soir de l\'arrivée',
        detail: `Vous arrivez le ${realFirstNight} mais l'hôtel ne commence que le ${h.checkIn}. Il manque l'hébergement de votre première nuit.` });
    } else {
      checks.push({ id: 'hotel-in', status: 'green', title: 'Arrivée hôtel cohérente',
        detail: `Check-in le ${h.checkIn}, le soir même de votre arrivée. Parfait.` });
    }

    // Departure day vs check-out.
    const realLastDay = dayUTC(lastDeparture);
    if (Date.parse(h.checkOut) < Date.parse(realLastDay)) {
      checks.push({ id: 'hotel-out', status: 'orange', title: 'Hôtel libéré trop tôt',
        detail: `Vous repartez le ${realLastDay} mais l'hôtel se termine le ${h.checkOut}. Prévoyez où passer la fin de séjour.` });
    }
    if (nights <= 0) {
      checks.push({ id: 'hotel-nights', status: 'red', title: 'Durée d\'hôtel invalide',
        detail: `Les dates d'hôtel (${h.checkIn} → ${h.checkOut}) ne donnent aucune nuit.` });
    }
  }

  if (checks.length === 0) {
    checks.push({ id: 'ok', status: 'green', title: 'Rien à vérifier',
      detail: 'Ajoutez des trajets et un hôtel pour que je vérifie les enchaînements.' });
  }

  const status = checks.reduce<Light>((acc, c) => worst(acc, c.status), 'green');
  const reds = checks.filter((c) => c.status === 'red').length;
  const oranges = checks.filter((c) => c.status === 'orange').length;
  const summary =
    status === 'red'
      ? `J'ai repéré ${reds} problème${reds > 1 ? 's' : ''} d'enchaînement à corriger avant de réserver.`
      : status === 'orange'
      ? `Tout s'enchaîne, avec ${oranges} point${oranges > 1 ? 's' : ''} de vigilance à garder en tête.`
      : `Parfait : tous les trajets et nuits s'enchaînent sans accroc.`;

  return { status, checks, summary };
}
