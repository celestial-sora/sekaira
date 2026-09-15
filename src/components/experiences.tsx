"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  ChevronDown,
  Globe2,
  Heart,
  Lock,
  MessageCircle,
  Plus,
  Send,
  Sparkles,
  UsersRound,
  UserRound,
  X,
  MapPin,
  Brain,
  Trash2,
  Pencil,
} from "lucide-react";
import type {
  Bootstrap,
  Character,
  World,
  Conversation,
  ChatData,
} from "@/lib/types";
import {
  api,
  Portrait,
  CharacterCard,
  PageTitle,
  SectionTitle,
  ErrorNote,
  Empty,
  displayTag,
} from "./shared";
import { useLanguage } from "./i18n";
function AvatarLoading() {
  const { text } = useLanguage();
  return (
    <p className="muted">{text("Loading avatar…", "กำลังโหลดอวาตาร์…")}</p>
  );
}
const VrmAvatar = dynamic(() => import("./vrm-avatar"), {
  ssr: false,
  loading: AvatarLoading,
});
type Refresh = () => Promise<Bootstrap>;
export function CharacterDetail({
  character: c,
  onChat,
  canEdit = false,
  onUpdate,
}: {
  character?: Character;
  onChat: (c: Character) => Promise<void>;
  canEdit?: boolean;
  onUpdate?: () => Promise<Bootstrap>;
}) {
  const { text, language } = useLanguage();
  const [busy, setBusy] = useState(false);
  const [tags, setTags] = useState(c?.tags ?? []);
  const [tagInput, setTagInput] = useState("");
  const [tagBusy, setTagBusy] = useState(false);
  const [tagError, setTagError] = useState("");
  useEffect(() => setTags(c?.tags ?? []), [c]);
  if (!c)
    return (
      <Empty
        title={text("Character not found", "ไม่พบตัวละคร")}
        href="/characters"
        label={text("Discover characters", "ค้นหาตัวละคร")}
      >
        {text(
          "They may belong to another account.",
          "ตัวละครนี้อาจเป็นของบัญชีอื่น",
        )}
      </Empty>
    );
  const character = c;
  async function saveTags(nextTags: string[]) {
    setTagBusy(true);
    setTagError("");
    try {
      const updated = await api<Character>(
        `characters/${character.id}`,
        "PATCH",
        {
          tags: nextTags,
        },
      );
      setTags(updated.tags);
      await onUpdate?.();
    } catch (error) {
      setTagError(
        error instanceof Error
          ? error.message
          : text("Unable to save tags.", "บันทึกแท็กไม่สำเร็จ"),
      );
    } finally {
      setTagBusy(false);
    }
  }
  function addTag(event: FormEvent) {
    event.preventDefault();
    const tag = tagInput.trim();
    if (!tag) return;
    if (
      tags.some((item) => item.toLocaleLowerCase() === tag.toLocaleLowerCase())
    ) {
      setTagError(text("That tag is already here.", "มีแท็กนี้อยู่แล้ว"));
      return;
    }
    if (tags.length >= 8) {
      setTagError(text("Use up to 8 tags.", "เพิ่มได้สูงสุด 8 แท็ก"));
      return;
    }
    setTagInput("");
    void saveTags([...tags, tag]);
  }
  return (
    <>
      <Link href="/characters" className="back-link">
        <ArrowLeft size={16} />
        {text("All characters", "ตัวละครทั้งหมด")}
      </Link>
      <section className="character-detail glass">
        <div className="detail-portrait">
          <Portrait avatar={c.avatar} />
          <span className="portrait-glow" />
        </div>
        <div className="detail-content">
          <span className="eyebrow">
            {c.owner_id
              ? text("YOUR ORIGINAL CHARACTER", "ตัวละครต้นฉบับของคุณ")
              : text(
                  "AN ORIGINAL OONCHAI CHARACTER",
                  "ตัวละครต้นฉบับจาก OONCHAI",
                )}
          </span>
          <h1>{c.name}</h1>
          <div className="tags">
            {tags.map((t) => (
              <span key={t} className={canEdit ? "editable-tag" : undefined}>
                {displayTag(t, language === "th")}
                {canEdit && (
                  <button
                    type="button"
                    aria-label={text(`Remove ${t}`, `ลบ ${t}`)}
                    disabled={tagBusy}
                    onClick={() =>
                      void saveTags(tags.filter((tag) => tag !== t))
                    }
                  >
                    ×
                  </button>
                )}
              </span>
            ))}
            <span>{text("Chat directly", "แชตโดยตรง")}</span>
          </div>
          {canEdit && (
            <form className="tag-editor" onSubmit={addTag}>
              <input
                value={tagInput}
                onChange={(event) => setTagInput(event.target.value)}
                maxLength={30}
                placeholder={text("Add a tag", "เพิ่มแท็ก")}
                aria-label={text("Add a tag", "เพิ่มแท็ก")}
              />
              <button
                className="button"
                type="submit"
                disabled={tagBusy || !tagInput.trim()}
              >
                <Plus size={15} />
                {text("Add tag", "เพิ่มแท็ก")}
              </button>
              {tagError && <span role="alert">{tagError}</span>}
            </form>
          )}
          <p className="detail-description">{c.description}</p>
          <blockquote>
            {c.greeting ||
              text(
                "Every story begins with a hello.",
                "ทุกเรื่องราวเริ่มต้นจากคำทักทาย",
              )}
          </blockquote>
          <button
            className="button primary"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              await onChat(c);
              setBusy(false);
            }}
          >
            {text("Chat Now", "แชตเลย")}
            <MessageCircle size={18} />
          </button>
          <p className="muted">
            {text(
              "A conversation, just the two of you. No persona needed.",
              "บทสนทนาระหว่างคุณสองคน ไม่ต้องใช้เพอร์โซนา",
            )}
          </p>
          <div className="detail-facts">
            <div>
              <h3>{text("Personality", "บุคลิก")}</h3>
              <p>
                {c.personality ||
                  text("Waiting to be discovered", "รอให้คุณมาค้นพบ")}
              </p>
            </div>
            <div>
              <h3>{text("Speaking style", "สไตล์การพูด")}</h3>
              <p>
                {c.speaking_style ||
                  text(
                    "Natural and conversational",
                    "เป็นธรรมชาติและเป็นกันเอง",
                  )}
              </p>
            </div>
            <div>
              <h3>{text("Likes", "สิ่งที่ชอบ")}</h3>
              <p>{c.likes || text("A new conversation", "บทสนทนาใหม่ ๆ")}</p>
            </div>
            <div>
              <h3>{text("Relationship", "ความสัมพันธ์")}</h3>
              <p>
                {c.relationship_behavior ||
                  text(
                    "Let it grow naturally",
                    "ปล่อยให้ค่อย ๆ เติบโตอย่างเป็นธรรมชาติ",
                  )}
              </p>
            </div>
          </div>
          {c.world_id && (
            <Link className="text-link" href={`/worlds/${c.world_id}`}>
              <Globe2 size={16} />
              {text(
                "Also part of a scenario",
                "เป็นส่วนหนึ่งของซีนาริโอนี้ด้วย",
              )}
              <ArrowRight size={16} />
            </Link>
          )}
          <details className="advanced">
            <summary>
              {text("Backstory & more", "เบื้องหลังและข้อมูลเพิ่มเติม")}
            </summary>
            <p>{c.backstory}</p>
            <p>{c.lore}</p>
            <h3>{text("Example dialogue", "ตัวอย่างบทสนทนา")}</h3>
            <p className="preserve">
              {c.example_dialogue ||
                text("Make the first move.", "เริ่มบทสนทนาได้เลย")}
            </p>
          </details>
        </div>
      </section>
    </>
  );
}
export function WorldDetail({
  id,
  data,
  refresh,
}: {
  id: string;
  data: Bootstrap;
  refresh: Refresh;
}) {
  const { text } = useLanguage();
  const router = useRouter(),
    [world, setWorld] = useState<World | null>(null),
    [chars, setChars] = useState<Character[]>([]),
    [selected, setSelected] = useState<string[]>([]),
    [persona, setPersona] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [importOpen, setImportOpen] = useState(false);
  const personas = data.personas.filter((p) => p.world_id === id),
    owned = world?.owner_id === data.user?.id;
  async function load() {
    const w = await api<{ world: World; characters: Character[] }>(
      `worlds/${id}`,
    );
    setWorld(w.world);
    setChars(w.characters);
    setSelected((s) =>
      s.length ? s : w.characters.slice(0, 3).map((c) => c.id),
    );
  }
  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [id]);
  useEffect(() => {
    if (!persona && personas.length) setPersona(personas[0].id);
  }, [personas, persona]);
  async function add(c: Character) {
    setBusy(true);
    try {
      await api(`worlds/${id}/characters`, "POST", { character_id: c.id });
      await load();
      setImportOpen(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function start() {
    setBusy(true);
    setError("");
    try {
      const c = await api<Conversation>("conversations", "POST", {
        world_id: id,
        persona_id: persona,
        scenario_id: null,
        character_ids: selected,
      });
      await refresh();
      router.push(`/chat/${c.id}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  if (!world)
    return (
      <section className="glass panel">
        <ErrorNote message={error} />
        <p>
          {error
            ? text(
                "Unable to open this scenario.",
                "ไม่สามารถเปิดซีนาริโอนี้ได้",
              )
            : text("Opening the gates…", "กำลังเปิดประตูสู่ซีนาริโอ…")}
        </p>
      </section>
    );
  return (
    <>
      <Link href="/worlds" className="back-link">
        <ArrowLeft size={16} />
        {text("All scenarios", "ซีนาริโอทั้งหมด")}
      </Link>
      <section className={`world-detail-hero glass world-${world.cover}`}>
        <span className="eyebrow">
          {owned
            ? text("YOUR SCENARIO", "ซีนาริโอของคุณ")
            : text("ORIGINAL SCENARIO", "ซีนาริโอต้นฉบับ")}{" "}
          · {world.genre.toUpperCase()}
        </span>
        <h1>{world.name}</h1>
        <p>{world.description}</p>
        <div className="tags">
          <span>
            <Globe2 size={14} />
            {text("Open-ended scenario", "เรื่องที่เล่นได้อย่างอิสระ")}
          </span>
          <span>
            <UsersRound size={14} />
            {chars.length} {text("characters", "ตัวละคร")}
          </span>
        </div>
      </section>
      <div className="world-detail-layout">
        <div>
          <section className="glass panel">
            <SectionTitle>
              {text("Your place in this scenario", "บทบาทของคุณในซีนาริโอนี้")}
            </SectionTitle>
            <div className="world-setup">
              <div className="setup-number">1</div>
              <div className="setup-field">
                <h3>{text("Choose your persona", "เลือกตัวตนของคุณ")}</h3>
                <p>
                  {text("Who will you be in", "คุณจะเป็นใครใน")} {world.name}?
                </p>
                {personas.length > 0 && (
                  <select
                    aria-label={text(
                      "Choose your persona",
                      "เลือกเพอร์โซนาของคุณ",
                    )}
                    value={persona}
                    onChange={(e) => setPersona(e.target.value)}
                  >
                    <option value="">
                      {text("Select a persona", "เลือกเพอร์โซนา")}
                    </option>
                    {personas.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ·{" "}
                        {p.role || text("Custom role", "บทบาทกำหนดเอง")}
                      </option>
                    ))}
                  </select>
                )}
                <Link className="text-link" href={`/personas/new?world=${id}`}>
                  <Plus size={15} />
                  {text("Create Persona", "สร้างเพอร์โซนา")}
                </Link>
              </div>
            </div>
            <div className="world-setup">
              <div className="setup-number">2</div>
              <div className="setup-field">
                <h3>
                  {text("Bring your characters together", "รวมตัวละครของคุณ")}
                </h3>
                <p>
                  {text(
                    "Select up to 5 characters for this scene.",
                    "เลือกตัวละครสำหรับฉากนี้ได้สูงสุด 5 ตัว",
                  )}
                </p>
                <div className="scene-choices">
                  {chars.map((c) => (
                    <button
                      className={selected.includes(c.id) ? "selected" : ""}
                      key={c.id}
                      onClick={() =>
                        setSelected((s) =>
                          s.includes(c.id)
                            ? s.filter((i) => i !== c.id)
                            : s.length < 5
                              ? [...s, c.id]
                              : s,
                        )
                      }
                    >
                      <Portrait avatar={c.avatar} />
                      <span>{c.name}</span>
                      {selected.includes(c.id) && <Check size={14} />}
                    </button>
                  ))}
                </div>
                {owned && (
                  <div className="inline-actions">
                    <button
                      className="button"
                      onClick={() => setImportOpen(true)}
                    >
                      <Plus size={15} />
                      {text("Add Existing Character", "เพิ่มตัวละครที่มีอยู่")}
                    </button>
                    <Link
                      className="button"
                      href={`/characters/new?world=${id}`}
                    >
                      <UsersRound size={15} />
                      {text("Create New Character", "สร้างตัวละครใหม่")}
                    </Link>
                  </div>
                )}
                {!chars.length && (
                  <p className="notice">
                    {text(
                      "Your scenario is ready. Add a character to begin.",
                      "ซีนาริโอพร้อมแล้ว เพิ่มตัวละครเพื่อเริ่มต้น",
                    )}
                  </p>
                )}
              </div>
            </div>
            <ErrorNote message={error} />
            <div className="form-footer">
              <span>
                {text(
                  "No additional scene setup required.",
                  "ไม่ต้องตั้งค่าฉากเพิ่มเติม",
                )}
              </span>
              <button
                className="button primary"
                disabled={busy || !persona || !selected.length || !data.user}
                onClick={start}
              >
                {text("Begin Roleplay", "เริ่มเล่นเรื่องนี้")}
                <ArrowRight size={17} />
              </button>
            </div>
            {!data.user && (
              <Link href="/settings" className="text-link">
                {text(
                  "Sign in to begin your story",
                  "เข้าสู่ระบบเพื่อเริ่มเรื่องราว",
                )}
              </Link>
            )}
          </section>
          <section className="glass panel lore-panel">
            <SectionTitle>
              {text(
                "The scenario behind the story",
                "ซีนาริโอเบื้องหลังเรื่องราว",
              )}
            </SectionTitle>
            {[
              [text("Lore", "ตำนานและภูมิหลัง"), world.lore],
              [text("Rules", "กฎ"), world.rules],
              [text("Power system", "ระบบพลัง"), world.power_system],
              [text("Timeline", "ลำดับเหตุการณ์"), world.timeline],
              [
                text("Starting scenario state", "สถานะเริ่มต้นของซีนาริโอ"),
                world.world_state,
              ],
            ]
              .filter((v) => v[1])
              .map(([name, content], index) => (
                <details className="advanced" key={name} open={index === 0}>
                  <summary>{name}</summary>
                  <p className="preserve">{content}</p>
                </details>
              ))}
          </section>
        </div>
        <aside>
          <section className="glass panel">
            <SectionTitle>
              {text("Places & people", "สถานที่และผู้คน")}
            </SectionTitle>
            <h3>
              <MapPin size={16} />
              {text("Locations", "สถานที่")}
            </h3>
            <p className="preserve muted">
              {world.locations ||
                text("An unexplored scenario", "ซีนาริโอที่ยังไม่ได้สำรวจ")}
            </p>
            <h3>
              <UsersRound size={16} />
              {text("Factions", "กลุ่มและฝ่าย")}
            </h3>
            <p className="preserve muted">
              {world.factions ||
                text("No factions yet", "ยังไม่มีกลุ่มหรือฝ่าย")}
            </p>
          </section>
          <section className="glass panel">
            <BookOpen />
            <h3>
              {text(
                "Your choices leave a mark.",
                "ทุกการเลือกของคุณทิ้งร่องรอยไว้",
              )}
            </h3>
            <p className="muted">
              {text(
                "The scenario remembers what happens. Relationships grow through the story you share.",
                "ซีนาริโอจะจดจำสิ่งที่เกิดขึ้น และความสัมพันธ์จะเติบโตผ่านเรื่องราวที่คุณร่วมสร้าง",
              )}
            </p>
          </section>
        </aside>
      </div>
      {importOpen && (
        <div className="modal-backdrop" onClick={() => setImportOpen(false)}>
          <section
            className="modal glass"
            role="dialog"
            aria-modal="true"
            aria-labelledby="import-title"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              autoFocus
              className="icon-button modal-close"
              aria-label={text(
                "Close character picker",
                "ปิดหน้าต่างเลือกตัวละคร",
              )}
              onClick={() => setImportOpen(false)}
            >
              <X />
            </button>
            <h2 id="import-title">
              {text("Add a character to", "เพิ่มตัวละครใน")} {world.name}
            </h2>
            <p>
              {text(
                "They will still be available for standalone chat.",
                "ตัวละครนี้จะยังคงใช้ในแชตเดี่ยวได้",
              )}
            </p>
            <div className="import-list">
              {data.characters
                .filter((c) => !chars.some((ch) => ch.id === c.id))
                .map((c) => (
                  <button key={c.id} disabled={busy} onClick={() => add(c)}>
                    <Portrait avatar={c.avatar} />
                    <div>
                      <strong>{c.name}</strong>
                      <small>{c.description}</small>
                    </div>
                    <Plus size={18} />
                  </button>
                ))}
            </div>
            {data.characters.every((c) =>
              chars.some((ch) => ch.id === c.id),
            ) && (
              <p>
                {text(
                  "All your available characters are already here.",
                  "ตัวละครทั้งหมดที่มีอยู่ถูกเพิ่มไว้ที่นี่แล้ว",
                )}
              </p>
            )}
          </section>
        </div>
      )}
    </>
  );
}
export function Chat({
  id,
  data,
  refresh,
}: {
  id: string;
  data: Bootstrap;
  refresh: Refresh;
}) {
  const { text, language } = useLanguage();
  const router = useRouter(),
    [chat, setChat] = useState<ChatData | null>(null),
    [editingMemory, setEditingMemory] = useState<string | null>(null),
    [editingContent, setEditingContent] = useState(""),
    [message, setMessage] = useState(""),
    [pendingMessage, setPendingMessage] = useState<{
      id: string;
      content: string;
    } | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [speaker, setSpeaker] = useState("auto"),
    [tab, setTab] = useState("scene"),
    [note, setNote] = useState(""),
    [privateNote, setPrivateNote] = useState(true),
    [confirmDelete, setConfirmDelete] = useState(false);
  const bottom = useRef<HTMLDivElement>(null),
    input = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    let active = true;
    api<ChatData>(`conversations/${id}`)
      .then((c) => {
        if (active) setChat(c);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [id]);
  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [chat?.messages.length, busy]);
  async function send(e: FormEvent) {
    e.preventDefault();
    if (!message.trim() || busy) return;
    const content = message.trim();
    setBusy(true);
    setError("");
    setMessage("");
    setPendingMessage({ id: `pending-${Date.now()}`, content });
    try {
      const c = await api<ChatData>(`conversations/${id}/messages`, "POST", {
        content,
        character_ids: speaker === "auto" ? undefined : [speaker],
      });
      setChat(c);
      setPendingMessage(null);
      await refresh();
    } catch (e) {
      setPendingMessage(null);
      setMessage(content);
      setError((e as Error).message);
    } finally {
      setBusy(false);
      input.current?.focus();
    }
  }
  async function remember(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      setChat(
        await api<ChatData>(`conversations/${id}/memories`, "POST", {
          content: note,
          private: privateNote,
        }),
      );
      setNote("");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function updateMemory(memoryId: string) {
    if (!editingContent.trim()) return;
    try {
      setChat(await api<ChatData>(`conversations/${id}/memories/${memoryId}`, "PATCH", { content: editingContent }));
      setEditingMemory(null);
    } catch (e) { setError((e as Error).message); }
  }
  async function deleteMemory(memoryId: string) {
    try { setChat(await api<ChatData>(`conversations/${id}/memories/${memoryId}`, "DELETE")); }
    catch (e) { setError((e as Error).message); }
  }
  if (!chat)
    return (
      <section className="glass panel">
        <ErrorNote message={error} />
        <p>
          {error
            ? text(
                "This conversation is unavailable.",
                "ไม่สามารถเปิดบทสนทนานี้ได้",
              )
            : text(
                "Finding your place in the story…",
                "กำลังพาคุณเข้าสู่เรื่องราว…",
              )}
        </p>
        <Link className="text-link" href="/chat">
          {text("All conversations", "บทสนทนาทั้งหมด")}
        </Link>
      </section>
    );
  const last = chat.messages.filter((m) => m.role === "assistant").at(-1),
    active =
      chat.characters.find(
        (c) => c.id === (speaker === "auto" ? last?.character_id : speaker),
      ) || chat.characters[0],
    state = JSON.parse(chat.conversation.state),
    emotion = busy ? "thinking" : last?.emotion || "idle",
    emotionLabel = localizedLabel(emotion);
  const userLabel = chat.persona?.name || data.user?.name || text("You", "คุณ");
  function localizedLabel(value: string) {
    if (language !== "th") return value;
    return (
      {
        thinking: "กำลังคิด",
        idle: "รออยู่",
        happy: "มีความสุข",
        sad: "เศร้า",
        angry: "โกรธ",
        surprised: "ประหลาดใจ",
        excited: "ตื่นเต้น",
        calm: "สงบ",
        fact: "ข้อเท็จจริง",
        event: "เหตุการณ์",
        relationship: "ความสัมพันธ์",
        preference: "ความชอบ",
      }[value.toLowerCase()] ?? value
    );
  }
  return (
    <div className="chat-layout">
      <section className="chat-main glass">
        <header className="chat-header">
          <Link
            className="icon-button"
            href="/chat"
            aria-label={text("Back to conversations", "กลับไปยังบทสนทนา")}
          >
            <ArrowLeft size={19} />
          </Link>
          <Portrait avatar={active.avatar} />
          <div>
            <h1>{chat.conversation.name}</h1>
            <p>
              <span className="status-dot ready" />
              {chat.world
                ? `${chat.location || chat.conversation.location} · ${chat.characters.length} ${text("characters", "ตัวละคร")}`
                : text("Standalone conversation", "บทสนทนาเดี่ยว")}
            </p>
          </div>
          <button
            className="icon-button delete-chat"
            aria-label={text("Delete conversation", "ลบบทสนทนา")}
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2 size={17} />
          </button>
        </header>
        <div className="chat-messages">
          <div className="chapter-marker">
            <Sparkles size={14} />
            {chat.world
              ? text("A NEW CHAPTER", "บทใหม่เริ่มต้นขึ้น")
              : text("A CONNECTION BEGINS", "ความสัมพันธ์เริ่มต้นขึ้น")}
            <Sparkles size={14} />
          </div>
          {chat.messages.map((m) => {
            const c = chat.characters.find((c) => c.id === m.character_id);
            return (
              <article key={m.id} className={`message message-${m.role}`}>
                {m.role === "assistant" && (
                  <Portrait avatar={c?.avatar || "0"} />
                )}
                <div>
                  <div className="message-author">
                    {m.role === "user"
                      ? userLabel
                      : m.role === "director"
                        ? text("Scenario Director", "ผู้กำกับเรื่อง")
                        : c?.name}
                    {m.role === "assistant" && (
                      <small>{localizedLabel(m.emotion)}</small>
                    )}
                  </div>
                  <div className="message-content">
                    {m.content
                      .split(/(\*[^*]+\*)/g)
                      .map((part, i) =>
                        part.startsWith("*") ? (
                          <em key={i}>{part.slice(1, -1)}</em>
                        ) : (
                          <span key={i}>{part}</span>
                        ),
                      )}
                  </div>
                </div>
              </article>
            );
          })}
          {pendingMessage && (
            <article
              key={pendingMessage.id}
              className="message message-user message-pending"
              aria-label={text("Sending message", "กำลังส่งข้อความ")}
            >
              <div>
                <div className="message-author">{userLabel}</div>
                <div className="message-content">{pendingMessage.content}</div>
              </div>
            </article>
          )}
          {busy && (
            <div className="thinking">
              <span />
              <span />
              <span />
              <p>
                {chat.world
                  ? text(
                      "Your story is unfolding…",
                      "เรื่องราวของคุณกำลังดำเนินต่อ…",
                    )
                  : text(
                      `${active.name} is thinking…`,
                      `${active.name} กำลังคิด…`,
                    )}
              </p>
            </div>
          )}
          <div ref={bottom} />
        </div>
        <div className="composer-area">
          <ErrorNote message={error} />
          {!data.groqReady && (
            <div className="notice">
              {text(
                "Groq is not connected yet. Your character’s greeting is ready; AI replies will be available after setup.",
                "ยังไม่ได้เชื่อมต่อ Groq คำทักทายของตัวละครพร้อมแล้ว และ AI จะตอบได้หลังตั้งค่าเสร็จ",
              )}{" "}
              <Link href="/settings">{text("Settings", "การตั้งค่า")}</Link>
            </div>
          )}
          {chat.world && (
            <div className="speaker-picker">
              <label htmlFor="speaker">
                {text("Next response", "ให้ใครตอบต่อ")}
              </label>
              <select
                id="speaker"
                value={speaker}
                onChange={(e) => setSpeaker(e.target.value)}
              >
                <option value="auto">
                  {text(
                    "Auto · Scenario Director",
                    "อัตโนมัติ · ผู้กำกับซีนาริโอ",
                  )}
                </option>
                {chat.characters.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <form onSubmit={send} className="composer">
            <textarea
              ref={input}
              aria-label={text("Your message", "ข้อความของคุณ")}
              placeholder={
                chat.world
                  ? text("What do you say or do?", "จะพูดหรือทำอะไรดี?")
                  : text(
                      "Say something, or start a story…",
                      "พูดอะไรสักอย่าง หรือเริ่มต้นเรื่องราว…",
                    )
              }
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={4000}
              rows={2}
              onKeyDown={(e) => {
                if (
                  e.key === "Enter" &&
                  !e.shiftKey &&
                  !e.nativeEvent.isComposing
                ) {
                  e.preventDefault();
                  if (!busy && message.trim())
                    e.currentTarget.form?.requestSubmit();
                }
              }}
            />
            <button
              type="submit"
              className="send-button"
              aria-label={text("Send message", "ส่งข้อความ")}
              disabled={busy || !message.trim()}
            >
              <Send size={19} />
            </button>
          </form>
          <div className="composer-caption">
            <span>
              {text(
                "Enter to send · Shift + Enter for a new line",
                "Enter เพื่อส่ง · Shift + Enter เพื่อขึ้นบรรทัดใหม่",
              )}
            </span>
            <span>{message.length}/4000</span>
          </div>
        </div>
      </section>
      <aside className="chat-inspector glass">
        <div className="inspector-tabs">
          <button
            className={tab === "scene" ? "active" : ""}
            onClick={() => setTab("scene")}
          >
            {text("Presence", "คนในเรื่อง")}
          </button>
          <button
            className={tab === "memory" ? "active" : ""}
            onClick={() => setTab("memory")}
          >
            {text("Memory", "ความทรงจำ")} <span>{chat.memories.length}</span>
          </button>
          {chat.world && (
            <button
              className={tab === "world" ? "active" : ""}
              onClick={() => setTab("world")}
            >
              {text("Scenario", "ซีนาริโอ")}
            </button>
          )}
        </div>
        {tab === "scene" ? (
          <>
            <div
              className={`avatar-stage emotion-${busy ? "talking" : last?.emotion || "idle"}`}
            >
              {active.avatar_id ? (
                <VrmAvatar
                  avatarId={active.avatar_id}
                  emotion={busy ? "talking" : last?.emotion || "idle"}
                />
              ) : (
                <Portrait avatar={active.avatar} />
              )}
              <div className="avatar-caption">
                <h2>{active.name}</h2>
                <span className="pill">{emotionLabel}</span>
              </div>
            </div>
            <div className="inspector-content">
              <h3>
                <Heart size={16} />
                {text("Your connection", "สายสัมพันธ์ของคุณ")}
              </h3>
              {chat.characters.map((c) => {
                const r = chat.relationships.find(
                  (r) => r.character_id === c.id,
                );
                return (
                  <div className="relationship" key={c.id}>
                    <div>
                      <span>{c.name}</span>
                      <small>
                        {r
                          ? text(`Trust ${r.trust}`, `ความไว้ใจ ${r.trust}`)
                          : text("Getting to know you", "กำลังทำความรู้จักคุณ")}
                      </small>
                    </div>
                    <div className="trust-track">
                      <span style={{ width: `${50 + (r?.trust || 0) / 2}%` }} />
                    </div>
                    {r?.note && <p>{r.note}</p>}
                  </div>
                );
              })}
              <h3>
                <UsersRound size={16} />
                {text("In this scene", "ตัวละครในฉากนี้")}
              </h3>
              <div className="scene-faces">
                {chat.characters.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setSpeaker(c.id)}
                    aria-label={text(
                      `Focus on ${c.name}`,
                      `โฟกัสที่ ${c.name}`,
                    )}
                  >
                    <Portrait avatar={c.avatar} />
                    <small>{c.name}</small>
                  </button>
                ))}
              </div>
            </div>
          </>
        ) : tab === "memory" ? (
          <div className="inspector-content">
            <h3>
              <Brain size={17} />
              {text("What stays with you", "สิ่งที่ยังคงอยู่ในความทรงจำ")}
            </h3>
            <p className="muted">
              {text(
                "Important facts and moments, remembered across conversations.",
                "ข้อเท็จจริงและช่วงเวลาสำคัญจะถูกจดจำข้ามบทสนทนา",
              )}
            </p>
            <div className="memory-list">
              {chat.memories.map((m) => (
                <article key={m.id}>
                  <div>
                    <span className="pill">{localizedLabel(m.type)}</span>
                    {m.known_by.includes(data.user?.id || "") ? (
                      <Lock size={13} />
                    ) : (
                      <UsersRound size={13} />
                    )}
                  </div>
                  {editingMemory === m.id ? (
                    <div className="memory-edit"><textarea value={editingContent} onChange={(e) => setEditingContent(e.target.value)} maxLength={1000} /><div><button className="button" type="button" onClick={() => updateMemory(m.id)}>{text("Save", "บันทึก")}</button><button className="text-link" type="button" onClick={() => setEditingMemory(null)}>{text("Cancel", "ยกเลิก")}</button></div></div>
                  ) : <p>{m.content}</p>}
                  {editingMemory !== m.id && <div className="memory-actions"><button type="button" aria-label={text("Edit memory", "แก้ไขความทรงจำ")} onClick={() => { setEditingMemory(m.id); setEditingContent(m.content); }}><Pencil size={13}/></button><button type="button" aria-label={text("Delete memory", "ลบความทรงจำ")} onClick={() => deleteMemory(m.id)}><Trash2 size={13}/></button></div>}
                  <small>
                    {m.known_by.includes(data.user?.id || "")
                      ? text("Only you", "มีเพียงคุณที่รู้")
                      : text(
                          `Known by ${
                            chat.characters
                              .filter((c) => m.known_by.includes(c.id))
                              .map((c) => c.name)
                              .join(", ") || "characters from an earlier scene"
                          }`,
                          `รับรู้โดย ${
                            chat.characters
                              .filter((c) => m.known_by.includes(c.id))
                              .map((c) => c.name)
                              .join(", ") || "ตัวละครจากฉากก่อนหน้า"
                          }`,
                        )}
                  </small>
                </article>
              ))}
              {!chat.memories.length && (
                <p className="muted">
                  {text(
                    "Memories will appear as your story unfolds.",
                    "ความทรงจำจะปรากฏขึ้นเมื่อเรื่องราวดำเนินต่อไป",
                  )}
                </p>
              )}
            </div>
            <form className="memory-form" onSubmit={remember}>
              <label className="field">
                <span>{text("Remember a fact", "จดจำข้อมูล")}</span>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  required
                  maxLength={1000}
                  placeholder={text(
                    "Something worth remembering…",
                    "สิ่งที่ควรค่าแก่การจดจำ…",
                  )}
                />
              </label>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={privateNote}
                  onChange={(e) => setPrivateNote(e.target.checked)}
                />
                {text("Keep this private", "เก็บเป็นความลับ")}
              </label>
              <button className="button" disabled={!note.trim()}>
                <Plus size={15} />
                {text("Save memory", "บันทึกความทรงจำ")}
              </button>
            </form>
          </div>
        ) : (
          <div className="inspector-content">
            <h3>
              <Globe2 size={17} />
              {chat.world?.name}
            </h3>
            <p>
              {state.summary ||
                text(
                  "Your scenario is waiting for its first chapter.",
                  "ซีนาริโอของคุณกำลังรอบทแรก",
                )}
            </p>
            <h3>{text("Scenario events", "เหตุการณ์ในเรื่อง")}</h3>
            {state.events?.length ? (
              state.events.map(
                (e: { content: string; at: string }, i: number) => (
                  <article className="world-event" key={i}>
                    <small>
                      {new Date(e.at).toLocaleDateString(
                        language === "th" ? "th-TH" : "en-US",
                      )}
                    </small>
                    <p>{e.content}</p>
                  </article>
                ),
              )
            ) : (
              <p className="muted">
                {text(
                  "Major events will become part of the scenario’s history.",
                  "เหตุการณ์สำคัญจะกลายเป็นส่วนหนึ่งของประวัติซีนาริโอ",
                )}
              </p>
            )}
            {chat.persona && (
              <>
                <h3>{text("Your persona", "เพอร์โซนาของคุณ")}</h3>
                <p>
                  {chat.persona.name} · {chat.persona.role}
                </p>
                <p className="muted">{chat.persona.public_facts}</p>
              </>
            )}
          </div>
        )}
      </aside>
      {confirmDelete && (
        <div className="modal-backdrop">
          <section
            className="modal glass"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-title"
          >
            <h2 id="delete-title">
              {text("Delete this conversation?", "ลบบทสนทนานี้หรือไม่?")}
            </h2>
            <p>
              {text(
                "Its messages and memories will be permanently removed.",
                "ข้อความและความทรงจำทั้งหมดจะถูกลบอย่างถาวร",
              )}
            </p>
            <div className="inline-actions">
              <button
                autoFocus
                className="button"
                onClick={() => setConfirmDelete(false)}
              >
                {text("Keep story", "เก็บเรื่องราวไว้")}
              </button>
              <button
                className="button danger"
                onClick={async () => {
                  try {
                    await api(`conversations/${id}`, "DELETE");
                    await refresh();
                    router.push("/chat");
                  } catch (e) {
                    setError((e as Error).message);
                    setConfirmDelete(false);
                  }
                }}
              >
                {text("Delete conversation", "ลบบทสนทนา")}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
