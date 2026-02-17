/**
 * Client-side perceptual hash (dHash) for duplicate image detection.
 * Generates a 64-bit hash based on gradient differences between adjacent pixels.
 * Two images are considered duplicates if their Hamming distance is ≤ 5.
 */

const HASH_SIZE = 9; // 9x8 grid → 8x8 = 64-bit hash

/**
 * Load an image file into an ImageData by drawing on a small canvas.
 */
function loadImageData(file: File): Promise<ImageData> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = HASH_SIZE;
      canvas.height = HASH_SIZE - 1; // 8 rows
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Canvas not supported"));
      ctx.drawImage(img, 0, 0, HASH_SIZE, HASH_SIZE - 1);
      resolve(ctx.getImageData(0, 0, HASH_SIZE, HASH_SIZE - 1));
    };
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = URL.createObjectURL(file);
  });
}

/**
 * Convert pixel to grayscale using luminosity method.
 */
function toGray(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/**
 * Generate a dHash (difference hash) for an image file.
 * Returns a 16-char hex string (64-bit hash).
 */
export async function generateImagePhash(file: File): Promise<string> {
  const imageData = await loadImageData(file);
  const { data, width } = imageData;

  let hash = "";
  for (let y = 0; y < HASH_SIZE - 1; y++) {
    for (let x = 0; x < HASH_SIZE - 1; x++) {
      const leftIdx = (y * width + x) * 4;
      const rightIdx = (y * width + x + 1) * 4;
      const leftGray = toGray(data[leftIdx], data[leftIdx + 1], data[leftIdx + 2]);
      const rightGray = toGray(data[rightIdx], data[rightIdx + 1], data[rightIdx + 2]);
      hash += leftGray < rightGray ? "1" : "0";
    }
  }

  // Convert binary string to hex
  let hex = "";
  for (let i = 0; i < 64; i += 4) {
    hex += parseInt(hash.substring(i, i + 4), 2).toString(16);
  }
  return hex;
}

/**
 * Calculate Hamming distance between two hex hashes.
 */
export function hammingDistance(hash1: string, hash2: string): number {
  if (hash1.length !== hash2.length) return 64; // max distance

  let distance = 0;
  for (let i = 0; i < hash1.length; i++) {
    const xor = parseInt(hash1[i], 16) ^ parseInt(hash2[i], 16);
    // Count bits in xor
    let bits = xor;
    while (bits > 0) {
      distance += bits & 1;
      bits >>= 1;
    }
  }
  return distance;
}

/** Threshold: hashes with Hamming distance ≤ this are considered duplicates */
export const PHASH_DUPLICATE_THRESHOLD = 5;
