// Registry of every design concept, used by the concept switcher and /concepts index.

export interface ConceptInfo {
  id: string;
  label: string;
  round: 1 | 2 | 3 | 4;
  /** One line: what the site *is* in this concept */
  thesis: string;
}

export const ROUNDS: Record<ConceptInfo['round'], { title: string; blurb: string }> = {
  1: { title: 'Round 1 — Looks', blurb: 'Three visual directions for the same portfolio.' },
  2: { title: 'Round 2 — Worlds', blurb: 'The portfolio as a place or an object, with play built in.' },
  3: { title: 'Round 3 — From the landscapes', blurb: 'Ideas that came out of the Santaquin + Oregon photos.' },
  4: { title: 'Round 4 — What the site is', blurb: 'Not a skin: five different answers to what jasonwride.studio should *do*.' },
};

export const CONCEPTS: ConceptInfo[] = [
  { id: 'book', label: 'The Book', round: 1, thesis: 'A photo monograph you page through.' },
  { id: 'contact-sheet', label: 'Contact Sheet', round: 1, thesis: 'A darkroom: develop negatives, circle your faves.' },
  { id: 'swiss', label: 'Swiss Index', round: 1, thesis: 'A strict poster grid with a name that dodges you.' },
  { id: 'field-notes', label: 'Field Notes', round: 2, thesis: 'A naturalist’s notebook of pinned specimens.' },
  { id: 'trading-cards', label: 'Trading Cards', round: 2, thesis: 'Rip a booster pack, collect the set.' },
  { id: 'trailhead', label: 'Trailhead', round: 2, thesis: 'A topo map trail that draws itself as you scroll.' },
  { id: 'golden-hour', label: 'Golden Hour', round: 3, thesis: 'Follows the real sun over Santaquin.' },
  { id: 'fogged-window', label: 'Fogged Window', round: 3, thesis: 'Wipe the glass to see outside.' },
  { id: 'text-me', label: 'Text Me', round: 4, thesis: 'The site is a conversation — an iMessage thread with Jason.' },
  { id: 'viewfinder', label: 'Viewfinder', round: 4, thesis: 'The site is a camera you operate.' },
  { id: 'almanac', label: 'The Almanac', round: 4, thesis: 'The site is a daily paper that’s different every day.' },
  { id: 'by-the-numbers', label: 'By the Numbers', round: 4, thesis: 'The site is a data story about how Jason shoots.' },
  { id: 'building', label: 'The Building', round: 4, thesis: 'The site is a building — take the elevator.' },
];

export type ConceptId = (typeof CONCEPTS)[number]['id'];
