"use client";
import Link from "next/link";
import { ArrowRight, ChevronRight, Plus, Sparkles } from "lucide-react";
import type { Character, World } from "@/lib/types";
import type { CSSProperties, ReactNode } from "react";
import { useLanguage } from "./i18n";
export function displayTag(tag: string, thai: boolean) {
  if (!thai) return tag;
  return (
    (
      {
        Yuri: "ยูริ",
        "Yaoi / BL": "วาย / BL",
        GL: "GL / หญิงรักหญิง",
        Romance: "โรแมนซ์",
        "Slow Burn": "ค่อย ๆ รัก",
        "Enemies to Lovers": "คู่กัดกลายเป็นคู่รัก",
        "Friends to Lovers": "เพื่อนเลื่อนเป็นแฟน",
        Tsundere: "ซึนเดเระ",
        Yandere: "ยันเดเระ",
        Kuudere: "คูเดเระ",
        Dandere: "ดันเดเระ",
        Himedere: "ฮิเมะเดเระ",
        Oujidere: "โอจิเดเระ",
        Genki: "สายพลังบวก",
        Fluffy: "ฟีลกู๊ด",
        Angst: "หน่วง ๆ",
        Drama: "ดราม่า",
        Comedy: "คอมเมดี้",
        "Slice of Life": "ชีวิตประจำวัน",
        Fantasy: "แฟนตาซี",
        Mystery: "ลึกลับ",
        "School Life": "วัยเรียน",
        Kind: "ใจดี",
        Curious: "ช่างสงสัย",
        Wise: "สุขุม",
        Gentle: "อ่อนโยน",
        Bold: "กล้าลุย",
        Playful: "ขี้เล่น",
        Warm: "อบอุ่น",
        Devoted: "ทุ่มเท",
        Calm: "ใจเย็น",
        Loyal: "ซื่อสัตย์",
      } as Record<string, string>
    )[tag] ?? tag
  );
}
export async function api<T>(
  path: string,
  method = "GET",
  data?: unknown,
): Promise<T> {
  const r = await fetch(`/api/${path}`, {
    method,
    headers: data ? { "Content-Type": "application/json" } : undefined,
    body: data ? JSON.stringify(data) : undefined,
    cache: "no-store",
  });
  let result;
  try {
    result = await r.json();
  } catch {
    throw new Error("The server is unavailable. Please try again.");
  }
  if (!r.ok) throw new Error(result.error || "Unable to complete this action.");
  return result;
}
export function Portrait({
  avatar = "0",
  className = "",
  name = "",
}: {
  avatar?: string;
  className?: string;
  name?: string;
}) {
  const remote = avatar.startsWith("https://") || avatar.startsWith("http://");
  const custom = avatar.startsWith("data:") || remote || avatar.startsWith("/api/characters/");
  const style: CSSProperties = custom ? {} : { backgroundPosition: `${Number(avatar) * 25}% 35%` };
  return (
    <span
      role={name ? "img" : undefined}
      aria-label={name || undefined}
      aria-hidden={!name}
      className={`portrait ${custom ? "portrait-custom" : ""} ${className}`}
      style={style}
    >{custom && <img src={avatar} alt="" loading="lazy" decoding="async" />}</span>
  );
}
export function SectionTitle({
  children,
  href,
  label,
}: {
  children: ReactNode;
  href?: string;
  label?: string;
}) {
  const { text } = useLanguage();
  return (
    <div className="section-title">
      <h2>{children}</h2>
      {href && (
        <Link href={href}>
          {label ?? text("View all", "ดูทั้งหมด")}
          <ChevronRight size={16} />
        </Link>
      )}
    </div>
  );
}
export function CharacterCard({ character: c }: { character: Character }) {
  const { text, language } = useLanguage();
  return (
    <div className="character-card">
      <Link href={`/characters/${c.id}`} className="card-hit-area" aria-label={text(`View ${c.name}`, `ดู ${c.name}`)} />
      <Portrait avatar={c.avatar} name={c.name} />
      <span className="card-badge">
        {c.world_id
          ? text("Scenario character", "ตัวละครในซีนาริโอ")
          : text("Standalone", "ตัวละครเดี่ยว")}
      </span>
      {c.owner_id && (c.visibility === 'public' || c.published) && (
        <span className="community-badge">
          {text("Community", "คอมมูนิตี้")}
        </span>
      )}
      <div className="character-caption">
        <div>
          <h3>{c.name}</h3>
          {c.owner_id && c.creator_name && (
            <Link className="creator-credit" href={`/profile/${c.owner_id}`}>
              {text("by", "โดย")} {c.creator_name}
            </Link>
          )}
          <div className="tags">
            {c.tags.slice(0, 2).map((t) => (
              <span key={t}>{displayTag(t, language === "th")}</span>
            ))}
          </div>
        </div>
        <span className="round-arrow">
          <ArrowRight size={17} />
        </span>
      </div>
    </div>
  );
}
export function WorldCard({ world: w }: { world: World }) {
  const { text, language } = useLanguage();
  return (
    <div className={`world-card world-${w.cover}`}>
      <Link href={`/worlds/${w.id}`} className="card-hit-area" aria-label={text(`View ${w.name}`, `ดู ${w.name}`)} />
      <span className="card-badge">
        {w.owner_id
          ? text("Your scenario", "ซีนาริโอของคุณ")
          : text("Original scenario", "ซีนาริโอต้นฉบับ")}
      </span>
      {w.owner_id && (
        <span className="community-badge">
          {text("Community", "คอมมูนิตี้")}
        </span>
      )}
      <div>
        <small>{displayTag(w.genre, language === "th")}</small>
        <h3>{w.name}</h3>
        {w.owner_id && w.creator_name && (
          <Link className="creator-credit" href={`/profile/${w.owner_id}`}>
            {text("by", "โดย")} {w.creator_name}
          </Link>
        )}
        <p>{w.description}</p>
      </div>
      <span className="round-arrow">
        <ArrowRight size={17} />
      </span>
    </div>
  );
}
export function Empty({
  title,
  children,
  href,
  label,
}: {
  title: string;
  children: ReactNode;
  href?: string;
  label?: string;
}) {
  return (
    <div className="empty">
      <Sparkles size={26} />
      <h3>{title}</h3>
      <p>{children}</p>
      {href && (
        <Link className="button" href={href}>
          <Plus size={16} />
          {label}
        </Link>
      )}
    </div>
  );
}
export function ErrorNote({ message }: { message: string }) {
  return message ? (
    <p className="error-note" role="alert">
      {message}
    </p>
  ) : null;
}
export function PageTitle({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <div className="page-title">
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {children}
    </div>
  );
}
