export type LetterTextAlignment = "left" | "center" | "right" | "justify";

export type LetterTextRun = {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  fontFamily?: string;
  fontSize?: number;
  color?: string;
};

export type LetterParagraph = {
  runs: LetterTextRun[];
  alignment: LetterTextAlignment;
};

type InlineStyle = Omit<LetterTextRun, "text">;
type StackEntry = { tag: string; style: InlineStyle; alignment: LetterTextAlignment; skip: boolean };

const blockTags = new Set(["p", "div", "li", "h1", "h2", "h3", "blockquote"]);
const safeFamily = (value: string) => {
  const first = value.split(",")[0]?.replace(/["']/g, "").trim() ?? "";
  return first.length <= 120 && /^[\w\s()-]+$/.test(first) && !/url|expression|var\(/i.test(first) ? first : "";
};
const safeColor = (value: string) => {
  const clean = value.trim();
  if (/^#[\da-f]{3,8}$/i.test(clean)) return clean;
  const rgb = clean.match(/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/i);
  if (rgb) return `#${rgb.slice(1, 4).map((channel) => Math.min(255, Number(channel)).toString(16).padStart(2, "0")).join("")}`;
  const named: Record<string, string> = { black: "#000000", white: "#ffffff", red: "#ff0000", green: "#008000", blue: "#0000ff", gray: "#808080", grey: "#808080", navy: "#000080", maroon: "#800000", purple: "#800080", teal: "#008080", olive: "#808000", silver: "#c0c0c0", lime: "#00ff00", fuchsia: "#ff00ff", aqua: "#00ffff", orange: "#ffa500", yellow: "#ffff00" };
  return named[clean.toLowerCase()] ?? "";
};

function decodeEntities(value: string) {
  return value.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (entity, code: string) => {
    const lower = code.toLowerCase();
    if (lower === "amp") return "&";
    if (lower === "lt") return "<";
    if (lower === "gt") return ">";
    if (lower === "quot") return '"';
    if (lower === "apos") return "'";
    if (lower === "nbsp") return "\u00a0";
    const numeric = lower.startsWith("#x") ? Number.parseInt(lower.slice(2), 16) : Number.parseInt(lower.slice(1), 10);
    try { return Number.isFinite(numeric) ? String.fromCodePoint(numeric) : entity; } catch { return entity; }
  });
}

function parseAttributes(input: string) {
  const attributes: Record<string, string> = {};
  const matcher = /([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g;
  for (const match of input.matchAll(matcher)) attributes[match[1].toLowerCase()] = match[2] ?? match[3] ?? match[4] ?? "";
  return attributes;
}

function applyStyle(parent: InlineStyle, tag: string, attributes: Record<string, string>): InlineStyle {
  const next = { ...parent };
  if (tag === "b" || tag === "strong" || tag === "h1" || tag === "h2" || tag === "h3") next.bold = true;
  if (tag === "i" || tag === "em") next.italic = true;
  if (tag === "u") next.underline = true;

  const style = attributes.style ?? "";
  const fontFamily = style.match(/(?:^|;)\s*font-family\s*:\s*([^;]+)/i)?.[1] ?? attributes.face;
  const fontSize = style.match(/(?:^|;)\s*font-size\s*:\s*([\d.]+)\s*(pt|px|em|rem|%)?/i);
  const color = style.match(/(?:^|;)\s*color\s*:\s*([^;]+)/i)?.[1] ?? attributes.color;
  const weight = style.match(/(?:^|;)\s*font-weight\s*:\s*([^;]+)/i)?.[1];
  const fontStyle = style.match(/(?:^|;)\s*font-style\s*:\s*([^;]+)/i)?.[1];
  const decoration = style.match(/(?:^|;)\s*text-decoration(?:-line)?\s*:\s*([^;]+)/i)?.[1];

  if (fontFamily) next.fontFamily = safeFamily(fontFamily) || next.fontFamily;
  if (fontSize) {
    const value = Number(fontSize[1]);
    const unit = (fontSize[2] ?? "pt").toLowerCase();
    if (Number.isFinite(value) && value > 0 && value <= 200) {
      next.fontSize = unit === "px" ? value * 0.75 : unit === "em" || unit === "rem" ? value * 12 : unit === "%" ? value * 0.12 : value;
    }
  }
  if (color) next.color = safeColor(color) || next.color;
  if (weight && (weight.toLowerCase() === "bold" || Number(weight) >= 600)) next.bold = true;
  if (fontStyle && /italic|oblique/i.test(fontStyle)) next.italic = true;
  if (decoration && /underline/i.test(decoration)) next.underline = true;
  return next;
}

function readAlignment(tag: string, attributes: Record<string, string>, inherited: LetterTextAlignment): LetterTextAlignment {
  const align = attributes.style?.match(/(?:^|;)\s*text-align\s*:\s*(left|center|right|justify)/i)?.[1]?.toLowerCase() ?? attributes.align?.toLowerCase();
  if (align === "left" || align === "center" || align === "right" || align === "justify") return align;
  return inherited;
}

function mergeRuns(runs: LetterTextRun[], text: string, style: InlineStyle) {
  if (!text) return;
  const previous = runs.at(-1);
  const normalized = {
    bold: style.bold,
    italic: style.italic,
    underline: style.underline,
    fontFamily: style.fontFamily,
    fontSize: style.fontSize,
    color: style.color,
  };
  if (previous && Object.keys(normalized).every((key) => previous[key as keyof typeof previous] === normalized[key as keyof typeof normalized])) previous.text += text;
  else runs.push({ text, ...normalized });
}

export function parseLetterHtml(html: string): LetterParagraph[] {
  const paragraphs: LetterParagraph[] = [];
  const stack: StackEntry[] = [];
  let runs: LetterTextRun[] = [];
  let skipped = false;
  const currentStyle = () => stack.at(-1)?.style ?? {};
  const currentAlignment = () => [...stack].reverse().find((entry) => blockTags.has(entry.tag))?.alignment ?? "left";
  const flush = (allowBlank = false) => {
    if (runs.length || allowBlank) paragraphs.push({ runs, alignment: currentAlignment() });
    runs = [];
  };

  const tokens = html.match(/<!--[\s\S]*?-->|<\/?[\w:-]+\b[^>]*>|[^<]+|</g) ?? [];
  for (const token of tokens) {
    if (token.startsWith("<!--")) continue;
    const close = token.match(/^<\/\s*([\w:-]+)/);
    const opening = token.match(/^<\s*([\w:-]+)([\s\S]*?)>$/);
    if (close) {
      const tag = close[1].toLowerCase();
      const matchIndex = stack.map((entry) => entry.tag).lastIndexOf(tag);
      if (matchIndex >= 0) {
        if (tag === "script" || tag === "style") skipped = false;
        if (blockTags.has(tag) && !skipped) flush(tag === "li");
        stack.splice(matchIndex);
      }
      continue;
    }
    if (opening) {
      const tag = opening[1].toLowerCase();
      if (tag === "script" || tag === "style") skipped = true;
      const attributes = parseAttributes(opening[2]);
      const parentAlignment = currentAlignment();
      if (blockTags.has(tag) && !skipped && runs.length) flush();
      const style = applyStyle(currentStyle(), tag, attributes);
      const alignment = readAlignment(tag, attributes, parentAlignment);
      if (!/\/\s*>$/.test(token) && tag !== "br") stack.push({ tag, style, alignment, skip: skipped });
      if (tag === "br" && !skipped) flush(true);
      continue;
    }
    if (skipped) continue;
    const text = decodeEntities(token);
    mergeRuns(runs, text, currentStyle());
  }
  if (runs.length) flush();
  return paragraphs;
}

export function letterPlainText(paragraphs: LetterParagraph[]) {
  return paragraphs.map((paragraph) => paragraph.runs.map((run) => run.text).join("")).join("\n");
}
