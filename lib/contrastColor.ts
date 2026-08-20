// WCAG relative-luminance based contrast pick -- given a background hex
// color, returns whichever of black/white text reads more clearly against it.
function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastTextColor(backgroundHex: string): '#000000' | '#ffffff' {
  try {
    const L = relativeLuminance(backgroundHex);
    const contrastWithWhite = 1.05 / (L + 0.05);
    const contrastWithBlack = (L + 0.05) / 0.05;
    return contrastWithWhite >= contrastWithBlack ? '#ffffff' : '#000000';
  } catch {
    return '#ffffff';
  }
}
