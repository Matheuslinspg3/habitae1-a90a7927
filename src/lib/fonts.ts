/**
 * Font registry — 60+ Google Fonts available for the project.
 * Fonts are loaded on-demand to avoid blocking page load.
 *
 * Usage:
 *   import { FONT_LIST, loadFont } from "@/lib/fonts";
 *   await loadFont("Playfair Display");
 *   // then apply via style={{ fontFamily: "Playfair Display" }}
 */

export interface FontEntry {
  name: string;
  category: "sans-serif" | "serif" | "display" | "handwriting" | "monospace";
  weights: number[];
}

export const FONT_LIST: FontEntry[] = [
  // Sans-serif
  { name: "Inter", category: "sans-serif", weights: [400, 500, 600, 700, 800] },
  { name: "DM Sans", category: "sans-serif", weights: [400, 500, 600, 700] },
  { name: "Montserrat", category: "sans-serif", weights: [400, 500, 600, 700, 800] },
  { name: "Poppins", category: "sans-serif", weights: [400, 500, 600, 700] },
  { name: "Raleway", category: "sans-serif", weights: [400, 500, 600, 700] },
  { name: "Outfit", category: "sans-serif", weights: [400, 500, 600, 700] },
  { name: "Space Grotesk", category: "sans-serif", weights: [400, 500, 600, 700] },
  { name: "Sora", category: "sans-serif", weights: [400, 500, 600, 700] },
  { name: "Nunito", category: "sans-serif", weights: [400, 500, 600, 700, 800] },
  { name: "Rubik", category: "sans-serif", weights: [400, 500, 600, 700] },
  { name: "Work Sans", category: "sans-serif", weights: [400, 500, 600, 700] },
  { name: "Figtree", category: "sans-serif", weights: [400, 500, 600, 700] },
  { name: "Plus Jakarta Sans", category: "sans-serif", weights: [400, 500, 600, 700, 800] },
  { name: "Manrope", category: "sans-serif", weights: [400, 500, 600, 700, 800] },
  { name: "Lexend", category: "sans-serif", weights: [400, 500, 600, 700] },
  { name: "Urbanist", category: "sans-serif", weights: [400, 500, 600, 700] },
  { name: "Albert Sans", category: "sans-serif", weights: [400, 500, 600, 700] },
  { name: "Cabin", category: "sans-serif", weights: [400, 500, 600, 700] },
  { name: "Karla", category: "sans-serif", weights: [400, 500, 600, 700] },
  { name: "Mulish", category: "sans-serif", weights: [400, 500, 600, 700, 800] },
  { name: "Barlow", category: "sans-serif", weights: [400, 500, 600, 700] },
  { name: "Exo 2", category: "sans-serif", weights: [400, 500, 600, 700] },
  { name: "Josefin Sans", category: "sans-serif", weights: [400, 500, 600, 700] },
  { name: "Quicksand", category: "sans-serif", weights: [400, 500, 600, 700] },
  { name: "Archivo", category: "sans-serif", weights: [400, 500, 600, 700] },
  { name: "Red Hat Display", category: "sans-serif", weights: [400, 500, 600, 700] },
  { name: "Overpass", category: "sans-serif", weights: [400, 500, 600, 700] },
  { name: "Maven Pro", category: "sans-serif", weights: [400, 500, 600, 700] },
  { name: "Sarabun", category: "sans-serif", weights: [400, 500, 600, 700] },
  { name: "Catamaran", category: "sans-serif", weights: [400, 500, 600, 700] },
  { name: "Signika", category: "sans-serif", weights: [400, 500, 600, 700] },
  { name: "Libre Franklin", category: "sans-serif", weights: [400, 500, 600, 700] },
  { name: "Jost", category: "sans-serif", weights: [400, 500, 600, 700] },
  { name: "Noto Sans", category: "sans-serif", weights: [400, 500, 600, 700] },

  // Serif
  { name: "Playfair Display", category: "serif", weights: [400, 500, 600, 700] },
  { name: "Lora", category: "serif", weights: [400, 500, 600, 700] },
  { name: "Merriweather", category: "serif", weights: [400, 700] },
  { name: "Cormorant Garamond", category: "serif", weights: [400, 500, 600, 700] },
  { name: "Bitter", category: "serif", weights: [400, 500, 600, 700] },
  { name: "Crimson Text", category: "serif", weights: [400, 600, 700] },
  { name: "EB Garamond", category: "serif", weights: [400, 500, 600, 700] },
  { name: "Libre Baskerville", category: "serif", weights: [400, 700] },
  { name: "DM Serif Display", category: "serif", weights: [400] },
  { name: "Fraunces", category: "serif", weights: [400, 500, 600, 700] },
  { name: "Spectral", category: "serif", weights: [400, 500, 600, 700] },
  { name: "Source Serif 4", category: "serif", weights: [400, 500, 600, 700] },
  { name: "Noto Serif", category: "serif", weights: [400, 500, 600, 700] },

  // Display
  { name: "Abril Fatface", category: "display", weights: [400] },
  { name: "Bebas Neue", category: "display", weights: [400] },
  { name: "Righteous", category: "display", weights: [400] },
  { name: "Fredoka", category: "display", weights: [400, 500, 600, 700] },
  { name: "Comfortaa", category: "display", weights: [400, 500, 600, 700] },
  { name: "Alfa Slab One", category: "display", weights: [400] },
  { name: "Lilita One", category: "display", weights: [400] },

  // Handwriting
  { name: "Dancing Script", category: "handwriting", weights: [400, 500, 600, 700] },
  { name: "Pacifico", category: "handwriting", weights: [400] },
  { name: "Sacramento", category: "handwriting", weights: [400] },
  { name: "Great Vibes", category: "handwriting", weights: [400] },
  { name: "Satisfy", category: "handwriting", weights: [400] },
  { name: "Caveat", category: "handwriting", weights: [400, 500, 600, 700] },

  // Monospace
  { name: "JetBrains Mono", category: "monospace", weights: [400, 500, 600, 700] },
  { name: "Fira Code", category: "monospace", weights: [400, 500, 600, 700] },
  { name: "Source Code Pro", category: "monospace", weights: [400, 500, 600, 700] },
];

// Track which fonts have been loaded
const loadedFonts = new Set<string>(["Inter"]);

/**
 * Dynamically loads a Google Font by injecting a <link> tag.
 * Safe to call multiple times — deduplicates automatically.
 */
export function loadFont(fontName: string): Promise<void> {
  if (loadedFonts.has(fontName)) return Promise.resolve();

  const entry = FONT_LIST.find((f) => f.name === fontName);
  if (!entry) {
    console.warn(`[fonts] Font "${fontName}" not found in registry`);
    return Promise.resolve();
  }

  loadedFonts.add(fontName);

  return new Promise((resolve) => {
    const weightsParam = entry.weights.join(";");
    const familyParam = `${fontName.replace(/ /g, "+")}:wght@${weightsParam}`;
    const url = `https://fonts.googleapis.com/css2?family=${familyParam}&display=swap`;

    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = url;
    link.onload = () => resolve();
    link.onerror = () => resolve(); // don't block on error
    document.head.appendChild(link);
  });
}

/**
 * Loads multiple fonts in parallel.
 */
export function loadFonts(fontNames: string[]): Promise<void[]> {
  return Promise.all(fontNames.map(loadFont));
}

/**
 * Returns grouped fonts by category.
 */
export function getFontsByCategory() {
  const groups: Record<string, FontEntry[]> = {};
  for (const font of FONT_LIST) {
    if (!groups[font.category]) groups[font.category] = [];
    groups[font.category].push(font);
  }
  return groups;
}

/** Category labels in Portuguese */
export const CATEGORY_LABELS: Record<string, string> = {
  "sans-serif": "Sans-serif",
  serif: "Serifada",
  display: "Display",
  handwriting: "Manuscrita",
  monospace: "Monoespaçada",
};
