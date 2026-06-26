// R101 — slugify a dashboard name to dash-case (e.g. "Weekly Report" → "weekly-report",
// "Báo cáo tuần" → "bao-cao-tuan"). Strips diacritics so accented names (vi) map to
// clean ASCII slugs. Pure + unit-tested.

const COMBINING_MARKS = /[̀-ͯ]/g;

export function slugify(input: string): string {
  return input
    .normalize('NFKD')
    .replace(COMBINING_MARKS, '') // drop combining diacritics (NFKD-decomposed accents)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-') // non-alphanumeric runs → single dash
    .replace(/^-+|-+$/g, ''); // trim leading/trailing dashes
}
