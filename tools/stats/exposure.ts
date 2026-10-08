// Aggregate camera stats across every photo in the picker's source folders:
//   bun run stats
// Writes src/data/exposure-stats.json with TOTALS ONLY — no file names, shoot
// names or images — so it's safe to publish even though the source photos aren't.

import exifr from 'exifr';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ROOT, scanLibrary } from '../picker/library';
import { sunElevation, localMidnight, dayEvents, phaseFor } from '../../src/lib/sun';

const { sources, shoots } = await scanLibrary();
const peopleSource = sources.find((s) => s.includes('Lightroom Exports'));

type Shot = {
  people: boolean;
  lens: string;
  f: number;
  t: number;
  iso: number;
  focal: number;
  when: Date;
};

const shots: Shot[] = [];
const sessionsWithPhotos = new Set<string>();

for (const shoot of shoots) {
  const people = !!peopleSource && shoot.photos[0] && shoot.photos[0].path.startsWith(peopleSource);
  for (const p of shoot.photos) {
    const e = await exifr
      .parse(p.path, ['Model', 'LensModel', 'FNumber', 'ExposureTime', 'ISO', 'FocalLength', 'DateTimeOriginal'])
      .catch(() => null);
    // Only the M50 (skips the phone/other-camera strays and edited copies without EXIF)
    if (!e || e.Model !== 'Canon EOS M50' || !(e.DateTimeOriginal instanceof Date)) continue;
    shots.push({
      people,
      lens: e.LensModel ?? 'unknown',
      f: e.FNumber,
      t: e.ExposureTime,
      iso: e.ISO,
      focal: Math.round(e.FocalLength),
      when: e.DateTimeOriginal,
    });
    if (people) sessionsWithPhotos.add(shoot.key);
  }
}

const people = shots.filter((s) => s.people);
const land = shots.filter((s) => !s.people);

const count = <T>(arr: T[], key: (x: T) => string | number) => {
  const m: Record<string, number> = {};
  for (const x of arr) {
    const k = String(key(x));
    m[k] = (m[k] ?? 0) + 1;
  }
  return m;
};

const shutterLabel = (t: number) => (t >= 1 ? `${t}s` : `1/${Math.round(1 / t)}`);
const median = (xs: number[]) => {
  const a = [...xs].sort((x, y) => x - y);
  return a.length ? a[Math.floor(a.length / 2)] : 0;
};

// Sun position at the moment of each portrait (camera clock = Utah local time)
const sunEvents = new Map<number, ReturnType<typeof dayEvents>>();
const sunInfo = people.map((s) => {
  const el = sunElevation(s.when);
  const mid = localMidnight(s.when);
  if (!sunEvents.has(mid)) sunEvents.set(mid, dayEvents(mid));
  const ev = sunEvents.get(mid)!;
  const minuteOfDay = Math.round((s.when.getTime() - mid) / 60000);
  return { el, phase: phaseFor(el), toSunset: ev.sunset != null ? ev.sunset - minuteOfDay : null };
});

const elevBins: Record<string, number> = {};
for (const { el } of sunInfo) {
  const b = Math.max(-12, Math.min(60, Math.floor(el / 3) * 3));
  elevBins[b] = (elevBins[b] ?? 0) + 1;
}

const toSunset = sunInfo.map((x) => x.toSunset).filter((x): x is number => x != null);
const perDay = count(people, (s) => s.when.toISOString().slice(0, 10));

const landOregon = land.filter((s) => s.when.getFullYear() === 2023 && s.when.getMonth() === 9);

const stats = {
  generated: new Date().toISOString().slice(0, 10),
  note: 'Totals only. Sun position estimated for Utah County (portraits) from each photo’s capture time.',
  people: {
    photos: people.length,
    sessions: sessionsWithPhotos.size,
    firstDate: people.reduce((a, s) => (s.when < a ? s.when : a), people[0].when).toISOString().slice(0, 10),
    lastDate: people.reduce((a, s) => (s.when > a ? s.when : a), people[0].when).toISOString().slice(0, 10),
    lenses: count(people, (s) => s.lens),
    apertures: count(people, (s) => s.f),
    shutters: count(people, (s) => shutterLabel(s.t)),
    isos: count(people, (s) => s.iso),
    hours: count(people, (s) => s.when.getHours()),
    months: count(people, (s) => s.when.getMonth()),
    weekdays: count(people, (s) => s.when.getDay()),
    busiestDay: Math.max(...Object.values(perDay)),
    shootingDays: Object.keys(perDay).length,
    fastestShutter: shutterLabel(Math.min(...people.map((s) => s.t))),
    slowestShutter: shutterLabel(Math.max(...people.map((s) => s.t))),
    maxIso: Math.max(...people.map((s) => s.iso)),
    minIso: Math.min(...people.map((s) => s.iso)),
    medianAperture: median(people.map((s) => s.f)),
    sun: {
      phases: count(sunInfo, (x) => x.phase),
      elevationBins3deg: elevBins,
      medianMinutesBeforeSunset: median(toSunset),
      withinHourOfSunset: toSunset.filter((m) => m >= -15 && m <= 60).length,
    },
  },
  landscapes: {
    photos: land.length,
    oregon: landOregon.length,
    utah: land.length - landOregon.length,
    isos: count(land, (s) => s.iso),
    apertures: count(land, (s) => s.f),
    lenses: count(land, (s) => s.lens),
  },
};

const out = join(ROOT, 'src/data/exposure-stats.json');
await writeFile(out, JSON.stringify(stats, null, 2) + '\n');
console.log(`Wrote ${out}: ${people.length} portrait frames, ${land.length} landscapes (totals only).`);
