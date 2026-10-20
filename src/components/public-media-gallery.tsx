"use client";

import { useState } from "react";
import Image from "next/image";
import type { PublicMediaItem } from "@/lib/public-media";

type Props = {
  items: PublicMediaItem[];
  title: string;
  description?: string;
  eyebrow?: string;
};

function mediaLabel(item: PublicMediaItem) {
  return item.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ");
}

export function PublicMediaGallery({ items, title, description, eyebrow = "Project media" }: Props) {
  const [showAll, setShowAll] = useState(false);
  if (items.length === 0) return null;
  const prioritizedItems = [...items].sort((a, b) => {
    const priority = (item: PublicMediaItem) => item.kind === "video" ? 0 : item.kind === "image" ? 1 : 2;
    return priority(a) - priority(b);
  });
  const visibleItems = showAll ? prioritizedItems : prioritizedItems.slice(0, 6);

  return <section className="public-media-section" aria-label={title}>
    <div className="public-media-heading"><div><p className="eyebrow">{eyebrow}</p><h2>{title}</h2></div>{description && <p>{description}</p>}</div>
    <div className="public-media-grid">
      {visibleItems.map((item) => <article className="public-media-card" key={item.href}>
        {item.kind === "image" && <a className="public-media-preview" href={item.href} target="_blank" rel="noreferrer" aria-label={`Open ${item.name}`}>
          <Image src={item.href} alt={mediaLabel(item)} width={1200} height={760} unoptimized />
        </a>}
        {item.kind === "video" && <video className="public-media-player" controls preload="metadata" aria-label={mediaLabel(item)}>
          <source src={item.href} />Your browser cannot preview this video format.
        </video>}
        {item.kind === "audio" && <div className="public-media-audio"><span aria-hidden="true">♫</span><audio controls preload="metadata" aria-label={mediaLabel(item)}><source src={item.href} />Your browser cannot preview this audio format.</audio></div>}
        {item.kind === "pdf" && <a className="public-media-file-preview" href={item.href} target="_blank" rel="noreferrer"><span aria-hidden="true">PDF</span><b>Open project report</b></a>}
        {item.kind === "file" && <div className="public-media-file-preview"><span aria-hidden="true">{item.extension.slice(0, 5)}</span><b>Media file</b></div>}
        <div className="public-media-caption"><a href={item.href} download aria-label={`Download ${mediaLabel(item)}`}>{item.kind === "pdf" ? "Download report" : "Download"} ↗</a></div>
      </article>)}
    </div>
    {prioritizedItems.length > 6 && <button className="public-media-more" type="button" onClick={() => setShowAll((expanded) => !expanded)} aria-expanded={showAll}>{showAll ? "Show fewer" : `Show more (${prioritizedItems.length - 6})`}</button>}
  </section>;
}
