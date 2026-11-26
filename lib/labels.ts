/**
 * Derives a readable chip tint from a label's real GitHub hex color
 * so a label's chip reflects how it's colored in the source repo.
 */
export function labelTint(hex: string): { background: string; color: string } {
  const clean = hex.replace(/^#/, "").padStart(6, "0");
  const r = parseInt(clean.slice(0, 2), 16) || 0;
  const g = parseInt(clean.slice(2, 4), 16) || 0;
  const b = parseInt(clean.slice(4, 6), 16) || 0;
  const mix = (channel: number, target: number, ratio: number) =>
    Math.round(channel * (1 - ratio) + target * ratio);
  const background = `rgb(${mix(r, 255, 0.86)}, ${mix(g, 255, 0.86)}, ${mix(b, 255, 0.86)})`;
  const color = `rgb(${mix(r, 0, 0.35)}, ${mix(g, 0, 0.35)}, ${mix(b, 0, 0.35)})`;
  return { background, color };
}
