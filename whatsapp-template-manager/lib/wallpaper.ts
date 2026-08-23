/**
 * The chat wallpaper.
 *
 * WhatsApp's own doodle wallpaper is Meta's artwork, so it is drawn here
 * rather than shipped as an image. The colours are sampled off the WhatsApp UI
 * Kit (iOS) export that the marketing screens are rebuilt from: the paper is
 * #f5f2eb and the doodles are #e7e1d7, a contrast low enough that the eye
 * reads texture rather than pictures.
 *
 * The glyphs are scattered across one 300px tile that repeats. They are drawn
 * at a size where nobody identifies them individually, which is the point: the
 * real one is a hundred tiny objects and any recognisable subset looks wrong.
 */

export const PAPER = "#f5f2eb";
export const PAPER_DARK = "#0b141a";
const INK = "#e7e1d7";

/** Line-art glyphs, each drawn in a 24x24 box and placed by the tile. */
const GLYPHS = [
  "M12 21s-7-4.5-7-9a4 4 0 017-2.6A4 4 0 0119 12c0 4.5-7 9-7 9z", // heart
  "M12 3l2.5 5.5L20 9.5l-4 4 1 6-5-2.7L7 19.5l1-6-4-4 5.5-1z", // star
  "M4 8h4l1.5-2h5L16 8h4v11H4z M12 13.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z", // camera
  "M6 8h10v6a4 4 0 01-8 0zM16 9h2a2 2 0 010 4h-2M5 21h13", // cup
  "M9 18V6l9-2v12M9 18a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0zM18 16a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z", // music
  "M3 12l18-7-7 18-2.5-7.5z", // plane
  "M6 18a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM18 18a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM6 14.5l4-7h5l3 7", // bike
  "M4 6h16v10H12l-4 4v-4H4z", // speech bubble
  "M3 7h18v11H3zM3 7l9 7 9-7", // envelope
  "M7 17a4 4 0 010-8 5 5 0 019.5 1.5A3.5 3.5 0 0117 17z", // cloud
  "M12 3c3 2.5 4.5 6 4.5 9L12 17l-4.5-5c0-3 1.5-6.5 4.5-9zM12 11.5a1.8 1.8 0 100-3.6 1.8 1.8 0 000 3.6zM8 17l-2 4 6-2 6 2-2-4", // rocket
  "M12 7a5 5 0 100 10 5 5 0 000-10zM12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M19 5l-1.5 1.5M6.5 17.5L5 19", // sun
  "M17 14a7 7 0 01-9-9 7.5 7.5 0 109 9z", // moon
  "M12 4a8 8 0 018 8H4a8 8 0 018-8zM12 12v6a2 2 0 004 0", // umbrella
  "M12 3a5 5 0 015 5c0 3.5-5 8-5 8S7 11.5 7 8a5 5 0 015-5zM11 16l1 2h1l1-2", // balloon
  "M4 10h16v10H4zM4 7h16v3H4zM12 7v13M12 7s-1-4-3.5-4A2 2 0 008.5 7zM12 7s1-4 3.5-4A2 2 0 0115.5 7z", // gift
  "M12 4a8 8 0 100 16 8 8 0 000-16zM12 8v4.5l3 2", // clock
  "M12 3a6 6 0 016 6c0 4.5-6 12-6 12S6 13.5 6 9a6 6 0 016-6zM12 11.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z", // pin
  "M12 3a5 5 0 015 5v4l2 3H5l2-3V8a5 5 0 015-5zM10 18a2 2 0 004 0", // bell
  "M5 4h6a2 2 0 012 2v14a2 2 0 00-2-2H5zM19 4h-6a2 2 0 00-2 2v14a2 2 0 012-2h6z", // book
  "M14 4a5 5 0 11-2.5 9.3L9 16H7v2H5v2H2v-3l7-7A5 5 0 0114 4zM15.5 8a1 1 0 100-2 1 1 0 000 2z", // key
  "M12 3a6 6 0 00-3.5 10.9V17h7v-3.1A6 6 0 0012 3zM10 20h4", // bulb
  "M20 5c0 8-5.5 13-11 13-2 0-3.5-.6-4.5-1.5C9 15 12 12 13 9c-3 2-6.5 2.5-8.5 1C6 6 10 4 13 5.5 15 6.5 17.5 6 20 5z", // leaf
  "M12 8a3 3 0 100 6 3 3 0 000-6zM12 8c0-3-4-4-5-2s2 4 5 2zM12 14c0 3 4 4 5 2s-2-4-5-2zM9 11c-3 0-4-4-2-5s4 2 2 5zM15 11c3 0 4 4 2 5s-4-2-2-5z", // flower
  "M3 12s4-5 8-5 6 3 8 5c-2 2-4 5-8 5s-8-5-8-5zM15 11.5a.9.9 0 100-1.8.9.9 0 000 1.8z", // fish
  "M5 8l1.5-3L9 8h6l2.5-3L19 8v7a7 7 0 01-14 0zM9.5 13a.9.9 0 100-1.8.9.9 0 000 1.8zM14.5 13a.9.9 0 100-1.8.9.9 0 000 1.8z", // cat
  "M12 3a9 9 0 100 18 9 9 0 000-18zM9 10a.9.9 0 100-1.8.9.9 0 000 1.8zM15 10a.9.9 0 100-1.8.9.9 0 000 1.8zM8 14a5 5 0 008 0", // smiley
  "M7 11l3.5-7A2 2 0 0114 5.5V10h4.5a2 2 0 012 2.4l-1.2 6A2 2 0 0117.3 20H7zM7 11H3v9h4z", // thumb
  "M4 5h16v9H4zM2 17h20l-1 2H3z", // laptop
  "M9 4h6l1 3 3 1v12H5V8l3-1zM12 12a3 3 0 100 6 3 3 0 000-6z", // bag
  "M12 4l7 4v8l-7 4-7-4V8zM12 4v16M5 8l7 4 7-4", // box
  "M6 20V9l6-5 6 5v11zM10 20v-6h4v6", // house
  "M7 5h10v14l-5-3-5 3z", // bookmark
  "M12 4a8 8 0 100 16 8 8 0 000-16zM12 4v8l5 3M8.5 4.5l-3 3M15.5 4.5l3 3", // watch
  "M4 6h13v12H4zM17 10l3-2v8l-3-2z", // video
];

/** Small filler marks, the dots and sparkles between the objects. */
const MARKS = ["M0 0m-1.4 0a1.4 1.4 0 102.8 0 1.4 1.4 0 10-2.8 0", "M0-3l.9 2.1L3 0 .9.9 0 3l-.9-2.1L-3 0l2.1-.9z"];

/**
 * A deterministic scatter. Positions come from a fixed hash rather than a
 * random number, so the wallpaper is the same on the server and in the
 * browser and never flickers on hydration.
 */
function scatter(): string {
  const parts: string[] = [];
  const step = 30;
  let n = 0;

  for (let y = 10; y < 300; y += step) {
    for (let x = 10; x < 300; x += step) {
      n += 1;
      const hash = (n * 2654435761) % 4294967296;
      const glyph = GLYPHS[hash % GLYPHS.length];
      const dx = ((hash >> 8) % 14) - 7;
      const dy = ((hash >> 16) % 14) - 7;
      const angle = ((hash >> 4) % 40) - 20;
      const size = 0.85 + ((hash >> 12) % 5) / 10;
      parts.push(
        `<g transform="translate(${x + dx} ${y + dy}) rotate(${angle}) scale(${size}) translate(-12 -12)"><path d="${glyph}"/></g>`,
      );

      // A mark in the gap, so the field has the density the real one has.
      const mark = MARKS[(hash >> 20) % MARKS.length];
      const mx = x + dx + 14 + ((hash >> 24) % 8);
      const my = y + dy + 13 + ((hash >> 6) % 8);
      parts.push(`<g transform="translate(${mx} ${my})"><path d="${mark}"/></g>`);
    }
  }
  return parts.join("");
}

const SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300" fill="none" stroke="${INK}" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round">${scatter()}</svg>`;

/** Ready for a `background-image`, tiled at 300px. */
export const WALLPAPER = `url("data:image/svg+xml,${encodeURIComponent(SVG)}")`;
