import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { ThemeId } from "@/lib/types";

type Weight = 400 | 500 | 600 | 700 | 800;
type FontSpec = { name: string; file: string; weight: Weight; style: "normal" | "italic" };
export type LoadedFont = { name: string; data: ArrayBuffer; weight: Weight; style: "normal" | "italic" };

const SPECS: Record<ThemeId, FontSpec[]> = {
  daylight: [
    { name: "Inter", file: "inter-latin-400-normal.woff", weight: 400, style: "normal" },
    { name: "Inter", file: "inter-latin-500-normal.woff", weight: 500, style: "normal" },
    { name: "Inter", file: "inter-latin-600-normal.woff", weight: 600, style: "normal" },
    { name: "Inter", file: "inter-latin-700-normal.woff", weight: 700, style: "normal" },
    { name: "Inter", file: "inter-latin-800-normal.woff", weight: 800, style: "normal" },
  ],
  broadcast: [
    { name: "Anton", file: "anton-latin-400-normal.woff", weight: 400, style: "normal" },
    { name: "Barlow Condensed", file: "barlow-condensed-latin-600-normal.woff", weight: 600, style: "normal" },
    { name: "Barlow Condensed", file: "barlow-condensed-latin-700-normal.woff", weight: 700, style: "normal" },
    { name: "Barlow", file: "barlow-latin-400-normal.woff", weight: 400, style: "normal" },
    { name: "Barlow", file: "barlow-latin-500-normal.woff", weight: 500, style: "normal" },
  ],
  editorial: [
    { name: "Newsreader", file: "newsreader-latin-400-normal.woff", weight: 400, style: "normal" },
    { name: "Newsreader", file: "newsreader-latin-600-normal.woff", weight: 600, style: "normal" },
    { name: "Newsreader", file: "newsreader-latin-400-italic.woff", weight: 400, style: "italic" },
    { name: "Public Sans", file: "public-sans-latin-400-normal.woff", weight: 400, style: "normal" },
    { name: "Public Sans", file: "public-sans-latin-600-normal.woff", weight: 600, style: "normal" },
    { name: "Public Sans", file: "public-sans-latin-700-normal.woff", weight: 700, style: "normal" },
  ],
  terminal: [
    { name: "JetBrains Mono", file: "jetbrains-mono-latin-400-normal.woff", weight: 400, style: "normal" },
    { name: "JetBrains Mono", file: "jetbrains-mono-latin-700-normal.woff", weight: 700, style: "normal" },
    { name: "JetBrains Mono", file: "jetbrains-mono-latin-800-normal.woff", weight: 800, style: "normal" },
  ],
};

const cache = new Map<string, ArrayBuffer>();

export async function fontsFor(theme: ThemeId): Promise<LoadedFont[]> {
  const dir = path.join(process.cwd(), "lib", "og", "fonts");
  return Promise.all(
    SPECS[theme].map(async (s) => {
      let data = cache.get(s.file);
      if (!data) {
        const buf = await readFile(path.join(dir, s.file));
        data = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
        cache.set(s.file, data);
      }
      return { name: s.name, data, weight: s.weight, style: s.style };
    }),
  );
}
