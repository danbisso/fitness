// Generates the app icon set into public/ from one inline SVG (a plain white
// dumbbell on the dark neutral background). Run with `npm run icons` after
// changing the drawing below.
//
//   icon.svg              rounded corners — browser tab favicon
//   apple-touch-icon.png  180px, square — iOS home screen (iOS rounds it itself;
//                         transparent corners would render black)
//   icon-192.png/-512.png square — manifest icons ("any maskable": the glyph sits
//                         well inside the 80% safe zone)
import { writeFile } from "node:fs/promises";
import sharp from "sharp";

const BG = "#0a0a0a"; // dark `--background` (oklch(0.145 0 0))
const FG = "#fafafa";

function svg({ rounded }) {
  const rx = rounded ? 112 : 0;
  // Two plates per side plus a bar whose ends peek out past the outer plates.
  const plates = [
    [116, 176, 44, 160], // outer left
    [168, 148, 44, 216], // inner left
    [300, 148, 44, 216], // inner right
    [352, 176, 44, 160], // outer right
  ]
    .map(([x, y, w, h]) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="14"/>`)
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="${rx}" fill="${BG}"/>
  <g fill="${FG}">
    <rect x="92" y="242" width="328" height="28" rx="14"/>
    ${plates}
  </g>
</svg>
`;
}

const square = Buffer.from(svg({ rounded: false }));
const png = (size) => sharp(square, { density: 300 }).resize(size, size).png();

await Promise.all([
  writeFile("public/icon.svg", svg({ rounded: true })),
  png(180).toFile("public/apple-touch-icon.png"),
  png(192).toFile("public/icon-192.png"),
  png(512).toFile("public/icon-512.png"),
]);
console.log("icons written to public/");
