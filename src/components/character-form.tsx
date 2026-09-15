"use client";

import { useState, type ChangeEvent, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ImagePlus,
  Sparkles,
  UsersRound,
} from "lucide-react";
import type { Bootstrap, Character } from "@/lib/types";
import { api, ErrorNote, PageTitle, Portrait } from "./shared";
import { useLanguage } from "./i18n";

type Refresh = () => Promise<Bootstrap>;
type CharacterDraft = {
  name: string;
  tags: string;
  description: string;
  personality: string;
  backstory: string;
  speaking_style: string;
  relationship_behavior: string;
  likes: string;
  dislikes: string;
  greeting: string;
  example_dialogue: string;
};
type GeneratedCharacter = Omit<CharacterDraft, "tags"> & { tags: string[] };
const emptyDraft: CharacterDraft = {
  name: "",
  tags: "",
  description: "",
  personality: "",
  backstory: "",
  speaking_style: "",
  relationship_behavior: "",
  likes: "",
  dislikes: "",
  greeting: "",
  example_dialogue: "",
};
const categoryGroups = [
  {
    title: "Relationship & romance",
    thaiTitle: "ความสัมพันธ์และโรแมนซ์",
    options: ["Yuri", "Yaoi / BL", "GL", "Romance", "Slow Burn", "Enemies to Lovers", "Friends to Lovers", "Love Triangle"],
  },
  {
    title: "Character archetypes",
    thaiTitle: "อาร์คีไทป์ตัวละคร",
    options: ["Tsundere", "Yandere", "Kuudere", "Dandere", "Himedere", "Oujidere", "Genki", "Reserved"],
  },
  {
    title: "Story mood",
    thaiTitle: "โทนเรื่อง",
    options: ["Fluffy", "Angst", "Drama", "Comedy", "Slice of Life", "Fantasy", "Mystery", "School Life"],
  },
] as const;

function Field({
  name,
  label,
  placeholder = "",
  area = false,
  required = false,
  value,
  onChange,
  hint,
}: {
  name: keyof CharacterDraft;
  label: string;
  placeholder?: string;
  area?: boolean;
  required?: boolean;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
}) {
  const props = {
    name,
    placeholder,
    required,
    value,
    onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      onChange(event.target.value),
    maxLength: 6000,
  };
  return (
    <label className={`field ${area ? "wide" : ""}`}>
      <span>
        {label}
        {required && <b> *</b>}
      </span>
      {area ? (
        <textarea {...props} rows={3} />
      ) : (
        <input {...props} maxLength={name === "name" ? 100 : 6000} />
      )}{" "}
      {hint && <small>{hint}</small>}
    </label>
  );
}

export function CharacterForm({
  data,
  refresh,
}: {
  data: Bootstrap;
  refresh: Refresh;
}) {
  const router = useRouter();
  const { text } = useLanguage();
  const [avatar, setAvatar] = useState("0");
  const [draft, setDraft] = useState<CharacterDraft>(emptyDraft);
  const [aiPrompt, setAiPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<Character | null>(null);
  const scenarioParam =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("world")
      : null;
  const update = <K extends keyof CharacterDraft>(
    key: K,
    value: CharacterDraft[K],
  ) => setDraft((current) => ({ ...current, [key]: value }));
  const selectedTags = draft.tags
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
  function toggleCategory(tag: string) {
    const selected = selectedTags.some(
      (item) => item.toLocaleLowerCase() === tag.toLocaleLowerCase(),
    );
    if (!selected && selectedTags.length >= 8) {
      setError(text("Choose up to 8 tags.", "เลือกแท็กได้สูงสุด 8 แท็ก"));
      return;
    }
    setError("");
    update(
      "tags",
      (selected
        ? selectedTags.filter(
            (item) => item.toLocaleLowerCase() !== tag.toLocaleLowerCase(),
          )
        : [...selectedTags, tag]
      ).join(", "),
    );
  }

  async function generate() {
    if (!aiPrompt.trim() || generating) return;
    setGenerating(true);
    setError("");
    try {
      const result = await api<GeneratedCharacter>(
        "characters/generate",
        "POST",
        { prompt: aiPrompt },
      );
      setDraft({ ...result, tags: result.tags.join(", ") });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGenerating(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const values = Object.fromEntries(
        new FormData(event.currentTarget).entries(),
      );
      let avatarId = null;
      if (values.vrm_url)
        avatarId = (
          await api<{ id: string }>("avatars", "POST", {
            type: "vrm",
            asset_url: values.vrm_url,
          })
        ).id;
      const character = await api<Character>("characters", "POST", {
        ...values,
        avatar,
        world_id: values.world_id || null,
        scenario_id: null,
        avatar_id: avatarId,
        tags: draft.tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
      });
      await refresh();
      setCreated(character);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function start() {
    if (!created) return;
    setBusy(true);
    setError("");
    try {
      const conversation = await api<{ id: string }>("conversations", "POST", {
        character_ids: [created.id],
        world_id: null,
        persona_id: null,
        scenario_id: null,
      });
      await refresh();
      router.push(`/chat/${conversation.id}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  function uploadArtwork(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 2_000_000) {
      setError(
        text(
          "Choose an image smaller than 2 MB.",
          "กรุณาเลือกรูปภาพที่มีขนาดไม่เกิน 2 MB",
        ),
      );
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setAvatar(String(reader.result));
    reader.readAsDataURL(file);
  }

  if (created)
    return (
      <div className="glass success-panel">
        <span className="success-check">
          <Check />
        </span>
        <Portrait avatar={avatar} />
        <span className="eyebrow">
          {text("A NEW CONNECTION BEGINS", "สายสัมพันธ์ใหม่ได้เริ่มต้นขึ้น")}
        </span>
        <h1>{text(`Meet ${created.name}.`, `พบกับ ${created.name}`)}</h1>
        <p>
          {text(
            "Your character is ready. Say your first hello.",
            "ตัวละครของคุณพร้อมแล้ว ลองกล่าวทักทายครั้งแรกได้เลย",
          )}
        </p>
        <div className="greeting-preview">
          {created.greeting ||
            text(
              "A new story is waiting for the first word.",
              "เรื่องราวใหม่กำลังรอถ้อยคำแรกของคุณ",
            )}
        </div>
        <ErrorNote message={error} />
        <button className="button primary" disabled={busy} onClick={start}>
          {text("Chat Now", "เริ่มแชต")}
          <ArrowRight size={17} />
        </button>
        {created.world_id && (
          <Link className="text-link" href={`/worlds/${created.world_id}`}>
            {text("Return to scenario setup", "กลับไปตั้งค่าซีนาริโอ")}
          </Link>
        )}
        <Link className="text-link" href={`/characters/${created.id}`}>
          {text("View character", "ดูตัวละคร")}
        </Link>
      </div>
    );

  return (
    <>
      <Link href="/create" className="back-link">
        <ArrowLeft size={16} />
        {text("Back to Create", "กลับไปหน้าสร้าง")}
      </Link>
      <PageTitle
        eyebrow={text("BRING SOMEONE TO LIFE", "สร้างใครสักคนให้มีชีวิต")}
        title={text("Create Character", "สร้างตัวละคร")}
        description={text(
          "Describe someone new, let AI shape the details, then make them yours.",
          "บรรยายตัวละครที่คุณต้องการ ให้ AI ช่วยเติมรายละเอียด แล้วปรับแต่งให้เป็นตัวคุณเอง",
        )}
      />
      <form onSubmit={submit} className="form-layout">
        <div className="form-main glass">
          <section className="ai-character-builder">
            <span className="eyebrow">
              {text("AI CHARACTER STUDIO", "สตูดิโอสร้างตัวละครด้วย AI")}
            </span>
            <div className="ai-builder-heading">
              <div>
                <h2>
                  {text("Who do you want to meet?", "คุณอยากพบตัวละครแบบไหน?")}
                </h2>
                <p>
                  {text(
                    "Describe their personality, role, mood, or story. AI will build an editable character draft.",
                    "บอกนิสัย บทบาท บรรยากาศ หรือเรื่องราวที่ต้องการ แล้ว AI จะสร้างร่างตัวละครที่คุณแก้ไขต่อได้",
                  )}
                </p>
              </div>
              <Sparkles size={25} />
            </div>
            <label className="field">
              <span>{text("Character idea", "ไอเดียตัวละคร")}</span>
              <textarea
                value={aiPrompt}
                onChange={(event) => setAiPrompt(event.target.value)}
                maxLength={2000}
                rows={3}
                placeholder={text(
                  "A sharp-tongued moon librarian who acts distant, secretly cares deeply, and speaks with dry humor…",
                  "บรรณารักษ์แห่งดวงจันทร์ผู้ปากร้าย วางตัวห่างเหิน แต่ลึก ๆ ใส่ใจคนอื่นและชอบพูดติดตลกแบบหน้าตาย…",
                )}
              />
            </label>
            <button
              className="button ai-generate"
              type="button"
              disabled={generating || !aiPrompt.trim() || !data.user}
              onClick={generate}
            >
              <Sparkles size={16} />
              {generating
                ? text("Creating your draft…", "กำลังสร้างร่างตัวละคร…")
                : text("Generate with AI", "สร้างด้วย AI")}
            </button>
            {!data.user && (
              <small>
                {text(
                  "Sign in to use AI generation.",
                  "เข้าสู่ระบบเพื่อใช้ AI ช่วยสร้างตัวละคร",
                )}
              </small>
            )}
          </section>
          <div className="form-section-heading">
            <UsersRound />
            <div>
              <h2>{text("The first impression", "ความประทับใจแรก")}</h2>
              <p>
                {text(
                  "Review the AI draft or write every detail yourself.",
                  "ตรวจร่างจาก AI หรือเขียนรายละเอียดทั้งหมดด้วยตัวเอง",
                )}
              </p>
            </div>
          </div>
          <div className="form-grid">
            <Field
              name="name"
              label={text("Name", "ชื่อ")}
              required
              placeholder={text(
                "What should we call them?",
                "อยากให้เราเรียกเขาว่าอะไร?",
              )}
              value={draft.name}
              onChange={(value) => update("name", value)}
            />
            <Field
              name="tags"
              label={text("Personality tags (optional)", "แท็กบุคลิก (ไม่บังคับ)")}
              placeholder={text(
                "Gentle, Curious, Loyal",
                "อ่อนโยน, ช่างสงสัย, ซื่อสัตย์",
              )}
              value={draft.tags}
              onChange={(value) => update("tags", value)}
              hint={text(
                "Separate tags with commas — you can add or change them later.",
                "คั่นแต่ละแท็กด้วยเครื่องหมายจุลภาค — เพิ่มหรือแก้ไขทีหลังได้",
              )}
            />
            <section className="category-picker wide" aria-label={text("Character categories", "หมวดหมู่ตัวละคร")}>
              <div className="category-picker-heading">
                <div>
                  <span>{text("Choose categories", "เลือกหมวดหมู่")}</span>
                  <p>{text("Optional — select what fits, then refine it anytime.", "ไม่บังคับ — เลือกเฉพาะที่ใช่ แล้วค่อยแก้ทีหลังได้")}</p>
                </div>
                <small>{selectedTags.length}/8</small>
              </div>
              <div className="category-groups">
                {categoryGroups.map((group) => (
                  <div className="category-group" key={group.title}>
                    <strong>{text(group.title, group.thaiTitle)}</strong>
                    <div className="category-chips">
                      {group.options.map((tag) => {
                        const selected = selectedTags.some((item) => item.toLocaleLowerCase() === tag.toLocaleLowerCase());
                        return <button type="button" key={tag} className={selected ? "selected" : undefined} aria-pressed={selected} onClick={() => toggleCategory(tag)}>{selected && <Check size={13} />}{tag}</button>;
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </section>
            <Field
              name="description"
              label={text("Description", "คำอธิบาย")}
              area
              placeholder={text(
                "A quiet dreamer who finds magic in everyday things…",
                "นักฝันผู้เงียบขรึมที่มองเห็นเวทมนตร์ในเรื่องธรรมดา…",
              )}
              value={draft.description}
              onChange={(value) => update("description", value)}
            />
            <Field
              name="personality"
              label={text("Personality", "บุคลิก")}
              area
              placeholder={text(
                "How do they think, feel, and react?",
                "เขาคิด รู้สึก และตอบสนองอย่างไร?",
              )}
              value={draft.personality}
              onChange={(value) => update("personality", value)}
            />
            <Field
              name="backstory"
              label={text("Backstory", "ภูมิหลัง")}
              area
              placeholder={text(
                "Every character has a story. What is theirs?",
                "ทุกตัวละครมีเรื่องราว เรื่องของเขาเป็นอย่างไร?",
              )}
              value={draft.backstory}
              onChange={(value) => update("backstory", value)}
            />
          </div>
          <div className="form-section-heading">
            <Sparkles />
            <div>
              <h2>
                {text(
                  "Make them feel like themselves",
                  "เติมชีวิตให้เป็นตัวตนของเขา",
                )}
              </h2>
              <p>
                {text(
                  "The little details behind every conversation.",
                  "รายละเอียดเล็ก ๆ ที่ทำให้ทุกบทสนทนามีความหมาย",
                )}
              </p>
            </div>
          </div>
          <div className="form-grid">
            <Field
              name="speaking_style"
              label={text("Speaking style", "สไตล์การพูด")}
              placeholder={text(
                "Warm, playful, a little poetic…",
                "อบอุ่น ขี้เล่น และมีความกวีเล็กน้อย…",
              )}
              value={draft.speaking_style}
              onChange={(value) => update("speaking_style", value)}
            />
            <Field
              name="relationship_behavior"
              label={text("Relationship behavior", "พฤติกรรมด้านความสัมพันธ์")}
              placeholder={text(
                "Slow to trust, deeply loyal once close…",
                "ไว้ใจคนยาก แต่ซื่อสัตย์มากเมื่อสนิทกัน…",
              )}
              value={draft.relationship_behavior}
              onChange={(value) => update("relationship_behavior", value)}
            />
            <Field
              name="likes"
              label={text("Likes", "สิ่งที่ชอบ")}
              placeholder={text(
                "Rainy days, old books, honest conversations",
                "วันฝนตก หนังสือเก่า บทสนทนาที่จริงใจ",
              )}
              value={draft.likes}
              onChange={(value) => update("likes", value)}
            />
            <Field
              name="dislikes"
              label={text("Dislikes", "สิ่งที่ไม่ชอบ")}
              placeholder={text(
                "Broken promises, crowded places",
                "การผิดสัญญา สถานที่แออัด",
              )}
              value={draft.dislikes}
              onChange={(value) => update("dislikes", value)}
            />
            <Field
              name="greeting"
              label={text("Greeting / first message", "คำทักทาย / ข้อความแรก")}
              area
              placeholder={text(
                "*Looks up with a soft smile.* I was wondering when you would arrive.",
                "*เงยหน้าขึ้นพร้อมรอยยิ้มอ่อนโยน* ฉันกำลังสงสัยอยู่เลยว่าคุณจะมาเมื่อไร",
              )}
              value={draft.greeting}
              onChange={(value) => update("greeting", value)}
            />
            <Field
              name="example_dialogue"
              label={text("Example dialogue", "ตัวอย่างบทสนทนา")}
              area
              placeholder={text(
                "You: Can I stay a while?\nCharacter: Of course. There is no hurry here.",
                "คุณ: ขออยู่ตรงนี้สักพักได้ไหม?\nตัวละคร: ได้สิ ที่นี่ไม่ต้องรีบร้อนหรอก",
              )}
              value={draft.example_dialogue}
              onChange={(value) => update("example_dialogue", value)}
            />
          </div>
          <details className="advanced" open={!!scenarioParam}>
            <summary>
              {text(
                "Optional scenario & avatar settings",
                "ตั้งค่าซีนาริโอและอวาตาร์เพิ่มเติม",
              )}{" "}
              <span>{text("Advanced", "ขั้นสูง")}</span>
            </summary>
            <p className="muted">
              {text(
                "Leave these empty to keep your character standalone.",
                "เว้นว่างไว้หากต้องการให้ตัวละครเป็นแบบเดี่ยว",
              )}
            </p>
            <div className="form-grid">
              <label className="field">
                <span>
                  {text("Scenario (optional)", "ซีนาริโอ (ไม่บังคับ)")}
                </span>
                <select name="world_id" defaultValue={scenarioParam || ""}>
                  <option value="">
                    {text(
                      "Standalone — no scenario",
                      "ตัวละครเดี่ยว — ไม่มีซีนาริโอ",
                    )}
                  </option>
                  {data.worlds
                    .filter((item) => item.owner_id === data.user?.id)
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                </select>
              </label>
              <label className="field">
                <span>{text("Faction (optional)", "ฝ่าย (ไม่บังคับ)")}</span>
                <input name="faction" maxLength={6000} />
              </label>
              <label className="field wide">
                <span>
                  {text(
                    "Character lore (optional)",
                    "ตำนานตัวละคร (ไม่บังคับ)",
                  )}
                </span>
                <textarea name="lore" rows={3} maxLength={6000} />
              </label>
              <label className="field">
                <span>
                  {text(
                    "VRM model URL (optional)",
                    "URL โมเดล VRM (ไม่บังคับ)",
                  )}
                </span>
                <input
                  name="vrm_url"
                  placeholder="https://your-host.com/character.vrm"
                  maxLength={2000}
                />
                <small>
                  {text(
                    "Use a model you own. Its host must allow cross-origin loading.",
                    "ใช้โมเดลที่คุณมีสิทธิ์ใช้งาน และโฮสต์ต้องอนุญาตการโหลดข้ามต้นทาง",
                  )}
                </small>
              </label>
            </div>
          </details>
          <ErrorNote message={error} />
          <div className="form-footer">
            <span>
              {text("Private to your account", "เป็นส่วนตัวสำหรับบัญชีของคุณ")}
            </span>
            <button
              className="button primary"
              disabled={busy || generating || !data.user}
            >
              {busy
                ? text("Creating…", "กำลังสร้าง…")
                : text("Create Character", "สร้างตัวละคร")}
              <ArrowRight size={17} />
            </button>
          </div>
          {!data.user && (
            <Link href="/settings" className="text-link">
              {text(
                "Sign in to create your character",
                "เข้าสู่ระบบเพื่อสร้างตัวละคร",
              )}
            </Link>
          )}
        </div>
        <aside className="form-preview glass">
          <span className="eyebrow">
            {text("YOUR CHARACTER", "ตัวละครของคุณ")}
          </span>
          <Portrait avatar={avatar} className="preview-portrait" />
          <h2>
            {draft.name || text("Someone unforgettable", "ใครสักคนที่ยากจะลืม")}
          </h2>
          <span className="pill">
            {text("Original character", "ตัวละครต้นฉบับ")}
          </span>
          <h3>{text("Choose artwork", "เลือกอาร์ตเวิร์ก")}</h3>
          <div className="avatar-options">
            {["0", "1", "2", "3", "4"].map((option) => (
              <button
                key={option}
                type="button"
                aria-label={text(
                  `Choose artwork ${Number(option) + 1}`,
                  `เลือกอาร์ตเวิร์ก ${Number(option) + 1}`,
                )}
                className={avatar === option ? "selected" : ""}
                onClick={() => setAvatar(option)}
              >
                <Portrait avatar={option} />
              </button>
            ))}
          </div>
          <label className="button upload-button">
            <ImagePlus size={16} />
            {text("Upload custom artwork", "อัปโหลดอาร์ตเวิร์กของคุณ")}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={uploadArtwork}
            />
          </label>
          <p className="muted">
            {text(
              "PNG, JPG or WebP · up to 2 MB",
              "PNG, JPG หรือ WebP · ไม่เกิน 2 MB",
            )}
            <br />
            {text(
              "Artwork is cropped automatically and never stretched.",
              "ระบบจะครอปรูปอัตโนมัติโดยไม่ยืดหรือบีบภาพ",
            )}
          </p>
          <div className="preview-note">
            <Sparkles size={19} />
            <p>
              {text(
                "Ready to chat as soon as you create them. No scenario or persona needed.",
                "สร้างเสร็จแล้วเริ่มแชตได้ทันที โดยไม่ต้องมีซีนาริโอหรือเพอร์โซนา",
              )}
            </p>
          </div>
        </aside>
      </form>
    </>
  );
}
