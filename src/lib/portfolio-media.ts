export const portfolioMediaTypes = {
  "image/avif": "image",
  "image/gif": "image",
  "image/jpeg": "image",
  "image/png": "image",
  "image/webp": "image",
  "video/mp4": "video",
  "video/quicktime": "video",
  "video/webm": "video",
  "audio/mp4": "audio",
  "audio/mpeg": "audio",
  "audio/ogg": "audio",
  "audio/wav": "audio",
  "audio/webm": "audio",
  "application/pdf": "pdf",
} as const;

export type PortfolioMediaKind = typeof portfolioMediaTypes[keyof typeof portfolioMediaTypes];
export type PortfolioMediaType = keyof typeof portfolioMediaTypes;

export function isPortfolioMediaType(value: string): value is PortfolioMediaType {
  return Object.hasOwn(portfolioMediaTypes, value);
}

export function getPortfolioMediaKind(value: string): PortfolioMediaKind | "file" {
  return isPortfolioMediaType(value) ? portfolioMediaTypes[value] : "file";
}