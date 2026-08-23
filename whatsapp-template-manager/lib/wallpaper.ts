/**
 * The chat wallpaper.
 *
 * `public/wa-wallpaper.webp` is WhatsApp's own doodle wallpaper, exported from
 * the WhatsApp UI Kit (iOS) Figma community file and resized to 720px wide,
 * which is 48 KB rather than the megabyte the full export costs. The paper
 * colour behind it is sampled from the same export.
 *
 * It is one phone screen rather than a seamless tile, so it is drawn the way
 * WhatsApp draws it: anchored to the top, full width, not repeated.
 */

export const PAPER = "#f5f2eb";
export const PAPER_DARK = "#0b141a";

export const WALLPAPER = 'url("/wa-wallpaper.webp")';
