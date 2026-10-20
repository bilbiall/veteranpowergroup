import { readdir } from "node:fs/promises";
import path from "node:path";

export const mediaFolders = {
  about: "About-location",
  power: "power-solutions",
  solar: "solar-solutions",
  borehole: "borehole-solutions",
  reports: "project-reports",
} as const;

export type PublicMediaFolder = typeof mediaFolders[keyof typeof mediaFolders];
export type PublicMediaKind = "image" | "video" | "audio" | "pdf" | "file";

export type PublicMediaItem = {
  name: string;
  href: string;
  kind: PublicMediaKind;
  extension: string;
};

const extensions: Record<PublicMediaKind, Set<string>> = {
  image: new Set([".avif", ".bmp", ".gif", ".heic", ".heif", ".jpeg", ".jpg", ".png", ".svg", ".tif", ".tiff", ".webp"]),
  video: new Set([".3gp", ".avi", ".m4v", ".mkv", ".mov", ".mp4", ".mpeg", ".mpg", ".ogv", ".webm"]),
  audio: new Set([".aac", ".aiff", ".flac", ".m4a", ".mid", ".midi", ".mp3", ".oga", ".ogg", ".opus", ".wav", ".weba", ".wma"]),
  pdf: new Set([".pdf"]),
  file: new Set(),
};

function getKind(extension: string): PublicMediaKind {
  for (const kind of ["image", "video", "audio", "pdf"] as const) {
    if (extensions[kind].has(extension)) return kind;
  }
  return "file";
}

export async function listPublicMedia(folder: PublicMediaFolder): Promise<PublicMediaItem[]> {
  const directory = path.join(process.cwd(), "public", folder);
  try {
    const files = await readdir(directory, { withFileTypes: true });
    return files
      .filter((entry) => entry.isFile() && !entry.name.startsWith("."))
      .map((entry) => {
        const extension = path.extname(entry.name).toLowerCase();
        return {
          name: entry.name,
          href: `/${folder}/${entry.name.split("/").map(encodeURIComponent).join("/")}`,
          kind: getKind(extension),
          extension: extension.slice(1).toUpperCase() || "FILE",
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }));
  } catch {
    return [];
  }
}
