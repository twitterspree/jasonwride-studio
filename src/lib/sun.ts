// Tiny solar-position helpers (low-precision NOAA/USNO formulas, good to ~1°),
// plus time-zone helpers so the page can follow the real sun over Santaquin.

export const SANTAQUIN = { lat: 39.9755, lon: -111.7849, tz: 'America/Denver' };

const rad = Math.PI / 180;

/** Sun elevation above the horizon in degrees at a given instant and place. */
export function sunElevation(date: Date, lat = SANTAQUIN.lat, lon = SANTAQUIN.lon): number {
  const n = date.getTime() / 86400000 + 2440587.5 - 2451545.0; // days since J2000
  const L = (280.46 + 0.9856474 * n) % 360;
  const g = ((357.528 + 0.9856003 * n) % 360) * rad;
  const lambda = (L + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * rad;
  const eps = (23.439 - 0.0000004 * n) * rad;
  const ra = Math.atan2(Math.cos(eps) * Math.sin(lambda), Math.cos(lambda));
  const dec = Math.asin(Math.sin(eps) * Math.sin(lambda));
  const gmst = (18.697374558 + 24.06570982441908 * n) % 24;
  const hourAngle = (gmst * 15 + lon) * rad - ra;
  const el = Math.asin(Math.sin(lat * rad) * Math.sin(dec) + Math.cos(lat * rad) * Math.cos(dec) * Math.cos(hourAngle));
  return el / rad;
}

/** Minutes offset of a time zone from UTC at a given instant (e.g. -360 for MDT). */
export function tzOffsetMinutes(date: Date, tz = SANTAQUIN.tz): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
      .formatToParts(date)
      .map((p) => [p.type, p.value])
  );
  const asUTC = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return Math.round((asUTC - date.getTime()) / 60000);
}

/** UTC instant of local midnight (in `tz`) for the day containing `date`. */
export function localMidnight(date: Date, tz = SANTAQUIN.tz): number {
  const off = tzOffsetMinutes(date, tz);
  const local = new Date(date.getTime() + off * 60000);
  const midnightLocalAsUTC = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate());
  return midnightLocalAsUTC - off * 60000;
}

/** Minutes since local midnight (in `tz`). */
export function localMinutes(date: Date, tz = SANTAQUIN.tz): number {
  return Math.floor((date.getTime() - localMidnight(date, tz)) / 60000);
}

export type Phase = 'night' | 'blue' | 'golden' | 'day';

export function phaseFor(elevation: number): Phase {
  if (elevation < -10) return 'night';
  if (elevation < -3) return 'blue';
  if (elevation < 7) return 'golden';
  return 'day';
}

/** Minute-of-day windows today for sunrise/sunset and the golden/blue hours (scanned per minute). */
export function dayEvents(midnightUTC: number) {
  const el = (m: number) => sunElevation(new Date(midnightUTC + m * 60000));
  const cross = (level: number, rising: boolean) => {
    for (let m = rising ? 0 : 1439; rising ? m < 1439 : m > 0; m += rising ? 1 : -1) {
      const a = el(m), b = el(m + (rising ? 1 : -1));
      if (rising ? a < level && b >= level : a < level && b >= level) return m;
    }
    return null;
  };
  return {
    sunrise: cross(-0.833, true),
    sunset: cross(-0.833, false),
    goldenEveningStart: cross(7, false),
    blueEveningEnd: cross(-10, false),
  };
}

export function fmtMinutes(m: number | null) {
  if (m == null) return '—';
  const h = Math.floor(m / 60), mm = String(m % 60).padStart(2, '0');
  return `${((h + 11) % 12) + 1}:${mm} ${h < 12 ? 'AM' : 'PM'}`;
}
