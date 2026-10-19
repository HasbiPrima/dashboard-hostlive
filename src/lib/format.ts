const intFmt = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 });
const decFmt = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 });

/** Rupiah, bilangan bulat tanpa desimal: Rp 12.500.000 */
export const rupiah = (n: number) => `Rp ${intFmt.format(Math.round(n))}`;

/** Ringkas untuk kartu statistik: Rp 148,5 jt */
export function rupiahShort(n: number) {
  if (n >= 1_000_000_000) return `Rp ${decFmt.format(Math.round(n / 100_000_000) / 10)} M`;
  if (n >= 1_000_000) return `Rp ${decFmt.format(Math.round(n / 100_000) / 10)} jt`;
  return rupiah(n);
}

export const num = (n: number) => intFmt.format(n);
export const percent = (n: number) => `${decFmt.format(n)}%`;
export const seconds = (n: number) => `${intFmt.format(n)} dtk`;

export const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
export const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

/** Selisih bertanda: +Rp 8.750.000 / −Rp 1.000 */
export const signedRupiah = (n: number) => `${n < 0 ? "−" : "+"}${rupiah(Math.abs(n))}`;
export const signedNum = (n: number) => `${n < 0 ? "−" : "+"}${intFmt.format(Math.abs(n))}`;
