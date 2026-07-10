"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { createPost } from "@/app/actions/posts";
import { detectEmbed, VideoPlayer } from "@/components/shared/VideoEmbed";
import type { Room, Tag } from "@/types";

type ImageState = {
  localId: string;
  file: File;
  preview: string;
  status: "uploading" | "done" | "error";
  path?: string;
  url?: string;
};

// ── Icons ─────────────────────────────────────────────────────────────────────
const UploadIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="17 8 12 3 7 8"/>
    <line x1="12" y1="3" x2="12" y2="15"/>
  </svg>
);
const CloseIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
);
const SearchIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="7" /><path d="m21 21-4.35-4.35" />
  </svg>
);
const PlusIcon = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <path d="M12 5v14M5 12h14" />
  </svg>
);
const ImageIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>
  </svg>
);
const LinkChainIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
  </svg>
);
const CodeIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>
  </svg>
);
const CalendarIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
  </svg>
);

// Same normalization the server re-applies — just used here to dedupe against
// what's already selected/typed before hitting the network.
function slugify(raw: string) {
  return raw.toLowerCase().trim().replace(/[\s_]+/g, "-").replace(/[^a-z0-9-]/g, "").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

type Format = "text" | "link" | "media" | "showcase";

const DRAFT_KEY = "sodev-post-draft";
type Draft = { title: string; body: string; linkUrl: string; repoUrl: string; demoUrl: string };

// ── Submit button ─────────────────────────────────────────────────────────────
function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="px-6 py-2.5 rounded-[4px] text-[13px] font-semibold text-white transition-all"
      style={{ background: "var(--color-accent)", opacity: pending ? 0.7 : 1 }}
    >
      {pending ? "Posting…" : "Post"}
    </button>
  );
}

// ── Flag toggle ───────────────────────────────────────────────────────────────
function Flag({ label, active, onToggle }: { label: string; active: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="px-3 py-1 rounded-full text-[11px] tracking-[.06em] font-medium transition-all"
      style={
        active
          ? { background: "var(--color-accent)", color: "#fff" }
          : { background: "var(--color-panel-2)", color: "var(--color-text-3)", border: "1px solid var(--color-line)" }
      }
    >
      {label}
    </button>
  );
}

// ── Attachment toggle button ─────────────────────────────────────────────────
function AttachBtn({ icon, label, active, onClick }: {
  icon: React.ReactNode; label: string; active: boolean; onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-[6px] px-3 py-[7px] rounded-[6px] text-[12px] font-medium transition-all"
      style={
        active
          ? { background: "var(--color-accent-soft)", color: "var(--color-accent)", border: "1px solid var(--color-accent)" }
          : { background: "var(--color-panel-2)", color: "var(--color-text-2)", border: "1px solid var(--color-line)" }
      }
    >
      {icon} {label}
    </button>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
interface Props { open: boolean; onClose: () => void; }

export default function CreatePostModal({ open, onClose }: Props) {
  const router = useRouter();
  const [state, action] = useActionState(createPost, null);
  const formRef = useRef<HTMLFormElement>(null);

  // Content — all controlled, so nothing is ever silently lost
  const [title, setTitle]         = useState("");
  const [body, setBody]           = useState("");
  const [linkUrl, setLinkUrl]     = useState("");
  const [repoUrl, setRepoUrl]     = useState("");
  const [demoUrl, setDemoUrl]     = useState("");
  const [images, setImages]       = useState<ImageState[]>([]);

  // Attachment sections (closing one clears its fields — it's "remove attachment")
  const [showImages, setShowImages] = useState(false);
  const [showLink, setShowLink]     = useState(false);
  const [showProject, setShowProject] = useState(false);

  // Event — orthogonal to format: any post can also be an event with a date.
  // The poster is just the post's image gallery; details live in the body.
  const [isEvent, setIsEvent]       = useState(false);
  const [eventStart, setEventStart] = useState("");

  // Meta
  const [allTags, setAllTags]     = useState<Tag[]>([]);
  const [tagSearch, setTagSearch] = useState("");
  const [selected, setSelected]   = useState<Tag[]>([]);
  const [newTags, setNewTags]     = useState<string[]>([]);
  const [isNsfw, setIsNsfw]       = useState(false);
  const [isSpoiler, setIsSpoiler] = useState(false);
  const [isOc, setIsOc]           = useState(false);
  const [rooms, setRooms]         = useState<Pick<Room, "id" | "name">[]>([]);
  const [roomId, setRoomId]       = useState<string>("");
  const [userId, setUserId]       = useState<string | null>(null);
  const [draftRestored, setDraftRestored] = useState(false);
  const fileInputRef              = useRef<HTMLInputElement>(null);

  const doneImages = images.filter(i => i.status === "done");

  // ── The format derives from what you attached — no tabs, no upfront choice.
  // Repo/demo links make it a Showcase; images alone make it Images; a lone
  // link makes it a Link post; nothing attached = Text. Priority mirrors how
  // the post renders (project links are the strongest signal of intent).
  const format: Format =
    (repoUrl.trim() || demoUrl.trim()) ? "showcase"
    : doneImages.length > 0            ? "media"
    : linkUrl.trim()                   ? "link"
    : "text";

  const linkEmbed = linkUrl.trim() ? detectEmbed(linkUrl.trim()) : null;

  // Fetch tags, rooms, and current user ID once
  useEffect(() => {
    const supabase = createClient();
    supabase.from("tags").select("*").eq("status", "active").order("name")
      .then(({ data }) => setAllTags((data as Tag[]) ?? []));
    supabase.from("rooms").select("id, name").eq("type", "public").order("member_count", { ascending: false }).limit(50)
      .then(({ data }) => setRooms((data ?? []) as Pick<Room, "id" | "name">[]));
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserId(user.id);
    });
  }, []);

  // ── Draft safety: restore text fields when the modal opens, save as you type.
  // An accidental close or refresh never eats a half-written post again.
  useEffect(() => {
    if (!open) return;
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const d: Draft = JSON.parse(raw);
      if (d.title)   setTitle(d.title);
      if (d.body)    setBody(d.body);
      if (d.linkUrl) { setLinkUrl(d.linkUrl); setShowLink(true); }
      if (d.repoUrl || d.demoUrl) { setRepoUrl(d.repoUrl ?? ""); setDemoUrl(d.demoUrl ?? ""); setShowProject(true); }
      if (d.title || d.body || d.linkUrl || d.repoUrl || d.demoUrl) setDraftRestored(true);
    } catch { /* corrupt draft — ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const d: Draft = { title, body, linkUrl, repoUrl, demoUrl };
    try {
      if (title || body || linkUrl || repoUrl || demoUrl) {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(d));
      } else {
        localStorage.removeItem(DRAFT_KEY);
      }
    } catch { /* storage full/blocked — drafts are best-effort */ }
  }, [open, title, body, linkUrl, repoUrl, demoUrl]);

  // Reset and close on success
  useEffect(() => {
    if (!state?.success) return;
    formRef.current?.reset();
    setTitle(""); setBody(""); setLinkUrl(""); setRepoUrl(""); setDemoUrl("");
    setShowImages(false); setShowLink(false); setShowProject(false);
    setSelected([]);
    setNewTags([]);
    setTagSearch("");
    setIsNsfw(false);
    setIsSpoiler(false);
    setIsOc(false);
    setRoomId("");
    setIsEvent(false);
    setEventStart("");
    setDraftRestored(false);
    images.forEach(img => URL.revokeObjectURL(img.preview));
    setImages([]);
    try { localStorage.removeItem(DRAFT_KEY); } catch {}
    router.refresh();
    onClose();
  }, [state?.success, onClose, router]);

  // Upload images to Supabase Storage as they're added
  async function uploadImages(files: File[]) {
    if (!userId) return;
    const supabase = createClient();
    const newItems: ImageState[] = files.map(file => ({
      localId: crypto.randomUUID(),
      file,
      preview: URL.createObjectURL(file),
      status: "uploading",
    }));
    setImages(prev => [...prev, ...newItems]);

    for (const item of newItems) {
      const ext  = item.file.name.split(".").pop()?.toLowerCase() ?? "jpg";
      const path = `${userId}/${crypto.randomUUID()}.${ext}`;
      const { data, error } = await supabase.storage
        .from("post-images")
        .upload(path, item.file, { cacheControl: "3600", upsert: false });

      if (error || !data) {
        setImages(prev => prev.map(i => i.localId === item.localId ? { ...i, status: "error" } : i));
      } else {
        const { data: { publicUrl } } = supabase.storage.from("post-images").getPublicUrl(data.path);
        setImages(prev => prev.map(i => i.localId === item.localId
          ? { ...i, status: "done", path: data.path, url: publicUrl }
          : i
        ));
      }
    }
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []).filter(f => f.size <= 10 * 1024 * 1024);
    const slots = 20 - images.length;
    if (files.length > 0 && slots > 0) uploadImages(files.slice(0, slots));
    e.target.value = "";
  }

  function removeImage(localId: string) {
    setImages(prev => {
      const img = prev.find(i => i.localId === localId);
      if (img) URL.revokeObjectURL(img.preview);
      return prev.filter(i => i.localId !== localId);
    });
  }

  // Toggling a section off = removing that attachment
  function toggleImages() {
    if (showImages) {
      images.forEach(img => URL.revokeObjectURL(img.preview));
      setImages([]);
    }
    setShowImages(v => !v);
  }
  function toggleLink() {
    if (showLink) setLinkUrl("");
    setShowLink(v => !v);
  }
  function toggleProject() {
    if (showProject) { setRepoUrl(""); setDemoUrl(""); }
    setShowProject(v => !v);
  }
  function toggleEvent() {
    if (isEvent) setEventStart("");
    setIsEvent(v => !v);
  }

  // Escape to close
  useEffect(() => {
    if (!open) return;
    const fn = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [open, onClose]);

  if (!open) return null;

  const totalTagCount = selected.length + newTags.length;

  const visibleTags = allTags.filter(
    t => !selected.find(s => s.id === t.id) &&
         t.name.toLowerCase().includes(tagSearch.toLowerCase())
  );

  const searchSlug = slugify(tagSearch);
  const canCreateTag =
    searchSlug.length > 0 &&
    totalTagCount < 5 &&
    !allTags.some(t => slugify(t.name) === searchSlug || t.slug === searchSlug) &&
    !newTags.some(n => slugify(n) === searchSlug);

  function toggleTag(tag: Tag) {
    setSelected(prev => {
      if (prev.find(t => t.id === tag.id)) return prev.filter(t => t.id !== tag.id);
      if (prev.length + newTags.length >= 5) return prev;
      return [...prev, tag];
    });
  }

  function createTag() {
    const name = tagSearch.trim();
    if (!canCreateTag) return;
    setNewTags(prev => [...prev, name]);
    setTagSearch("");
  }

  function removeNewTag(name: string) {
    setNewTags(prev => prev.filter(n => n !== name));
  }

  const formatLabel: Record<Format, string> = {
    text: "Text", link: "Link", media: "Images", showcase: "Showcase",
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      {/* scrim */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" onClick={onClose} />

      {/* panel */}
      <div
        className="relative w-full max-w-[580px] rounded-[10px] flex flex-col overflow-hidden max-h-[90vh]"
        style={{ background: "var(--color-panel)", border: "1px solid var(--color-line)" }}
      >
        {/* header */}
        <div
          className="flex items-center justify-between px-6 py-4 flex-shrink-0"
          style={{ borderBottom: "1px solid var(--color-line)" }}
        >
          <div className="flex items-center gap-3">
            <h2 className="text-[15px] font-semibold m-0" style={{ color: "var(--color-text)" }}>
              New Post
            </h2>
            {/* Derived format — you never pick it, it follows what you attach */}
            <span
              className="text-[9.5px] tracking-[.1em] uppercase px-[7px] py-[3px] rounded-[3px] font-semibold"
              style={
                format === "showcase" ? { background: "var(--color-accent-soft)", color: "var(--color-accent)" }
                : format === "link"   ? { background: "rgba(56,139,253,.14)", color: "#58a6ff" }
                : format === "media"  ? { background: "rgba(255,86,48,.14)", color: "var(--color-ember)" }
                : { background: "rgba(255,255,255,.06)", color: "var(--color-text-3)" }
              }
              title="Post type — set automatically by what you attach"
            >
              {formatLabel[format]}
            </span>
            {isEvent && (
              <span
                className="text-[9.5px] tracking-[.1em] uppercase px-[7px] py-[3px] rounded-[3px] font-semibold"
                style={{ background: "rgba(46,164,79,.16)", color: "#3fb950" }}
              >
                Event
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="grid place-items-center rounded-[6px] transition-all"
            style={{ width: 30, height: 30, color: "var(--color-text-3)" }}
            onMouseEnter={e => { (e.currentTarget).style.background = "var(--color-panel-2)"; (e.currentTarget).style.color = "var(--color-text)"; }}
            onMouseLeave={e => { (e.currentTarget).style.background = "transparent"; (e.currentTarget).style.color = "var(--color-text-3)"; }}
          >
            <CloseIcon />
          </button>
        </div>

        {/* scrollable body */}
        <div className="overflow-y-auto scroll flex-1">
          <form ref={formRef} action={action} className="flex flex-col gap-5 p-6">

            {/* hidden fields — everything submits from state, so no typed text
                is ever lost when an attachment section is opened or closed */}
            <input type="hidden" name="format"     value={format} />
            <input type="hidden" name="link_url"   value={linkUrl.trim()} />
            <input type="hidden" name="repo_url"   value={repoUrl.trim()} />
            <input type="hidden" name="demo_url"   value={demoUrl.trim()} />
            <input type="hidden" name="tag_ids"    value={selected.map(t => t.id).join(",")} />
            <input type="hidden" name="new_tags"   value={newTags.join(",")} />
            <input type="hidden" name="is_nsfw"    value={isNsfw    ? "1" : "0"} />
            <input type="hidden" name="is_spoiler" value={isSpoiler ? "1" : "0"} />
            <input type="hidden" name="is_oc"      value={isOc      ? "1" : "0"} />
            <input type="hidden" name="room_id"    value={roomId} />
            <input type="hidden" name="is_event"   value={isEvent ? "1" : "0"} />
            <input type="hidden" name="event_starts_at" value={isEvent ? eventStart : ""} />
            <input type="hidden" name="images" value={JSON.stringify(
              doneImages.map(i => ({ path: i.path!, url: i.url! }))
            )} />

            {draftRestored && (
              <p className="text-[11.5px] m-0 px-3 py-2 rounded-[6px]" style={{ background: "var(--color-panel-2)", color: "var(--color-text-3)", border: "1px solid var(--color-line)" }}>
                Draft restored from last time.{" "}
                <button
                  type="button"
                  className="underline"
                  style={{ color: "var(--color-text-2)" }}
                  onClick={() => {
                    setTitle(""); setBody(""); setLinkUrl(""); setRepoUrl(""); setDemoUrl("");
                    setShowLink(false); setShowProject(false); setDraftRestored(false);
                    try { localStorage.removeItem(DRAFT_KEY); } catch {}
                  }}
                >
                  Discard it
                </button>
              </p>
            )}

            {/* ── Title ── */}
            <div className="field">
              <input
                id="cp-title" name="title" type="text" placeholder=" " required maxLength={120}
                value={title} onChange={e => setTitle(e.target.value)}
              />
              <label htmlFor="cp-title">Title</label>
            </div>

            {/* ── Body ── */}
            <div
              className="field"
              style={{ height: "auto", paddingTop: 0, paddingBottom: 0 }}
            >
              <textarea
                id="cp-body"
                name="body_md"
                placeholder=" "
                rows={4}
                required={format === "text"}
                value={body}
                onChange={e => setBody(e.target.value)}
                style={{
                  background: "transparent",
                  border: "none",
                  outline: "none",
                  resize: "vertical",
                  width: "100%",
                  color: "var(--color-text)",
                  fontSize: 13.5,
                  paddingTop: 20,
                  paddingBottom: 8,
                  lineHeight: 1.6,
                }}
              />
              <label htmlFor="cp-body">
                {format === "text" ? "What's on your mind? (Markdown supported)" : "Description (optional · Markdown supported)"}
              </label>
            </div>

            {/* ── Add to your post ── */}
            <div>
              <p className="text-[11px] tracking-[.08em] uppercase mb-2" style={{ color: "var(--color-text-3)" }}>
                Add to your post
              </p>
              <div className="flex flex-wrap gap-2">
                <AttachBtn icon={<ImageIcon />}     label={doneImages.length > 0 ? `Images (${doneImages.length})` : "Images"} active={showImages}  onClick={toggleImages} />
                <AttachBtn icon={<LinkChainIcon />} label="Link / Video"    active={showLink}    onClick={toggleLink} />
                <AttachBtn icon={<CodeIcon />}      label="Repo & Demo"     active={showProject} onClick={toggleProject} />
                <AttachBtn icon={<CalendarIcon />}  label="Event"           active={isEvent}     onClick={toggleEvent} />
              </div>
            </div>

            {/* ── Event section ── */}
            {isEvent && (
              <div className="flex flex-col gap-2">
                <p className="text-[11px] tracking-[.08em] uppercase m-0" style={{ color: "var(--color-text-3)" }}>
                  When is it?
                </p>
                <input
                  type="datetime-local"
                  required
                  value={eventStart}
                  onChange={e => setEventStart(e.target.value)}
                  className="w-full rounded-[6px] text-[13px] px-3 py-[9px] outline-none"
                  style={{ background: "var(--color-panel-2)", border: "1px solid var(--color-line)", color: eventStart ? "var(--color-text)" : "var(--color-text-3)", colorScheme: "dark" }}
                />
                <p className="text-[11px] m-0" style={{ color: "var(--color-text-3)" }}>
                  Attach images to give it a poster — the first one is what people see on Explore. Details go in the description.
                </p>
              </div>
            )}

            {/* ── Link / video section ── */}
            {showLink && (
              <div className="flex flex-col gap-3">
                <div className="field">
                  <input
                    id="cp-link"
                    type="url"
                    placeholder=" "
                    value={linkUrl}
                    onChange={e => setLinkUrl(e.target.value)}
                  />
                  <label htmlFor="cp-link">Link or video URL (YouTube embeds automatically)</label>
                </div>
                {linkEmbed && (
                  <div className="rounded-[8px] overflow-hidden" style={{ border: "1px solid var(--color-line)" }}>
                    <VideoPlayer embed={linkEmbed} />
                  </div>
                )}
              </div>
            )}

            {/* ── Repo & demo section ── */}
            {showProject && (
              <div className="flex flex-col gap-4">
                <div className="field">
                  <input
                    id="cp-repo" type="url" placeholder=" "
                    value={repoUrl} onChange={e => setRepoUrl(e.target.value)}
                  />
                  <label htmlFor="cp-repo">GitHub / Repo URL</label>
                </div>
                <div className="field">
                  <input
                    id="cp-demo" type="url" placeholder=" "
                    value={demoUrl} onChange={e => setDemoUrl(e.target.value)}
                  />
                  <label htmlFor="cp-demo">Live Demo URL (optional)</label>
                </div>
              </div>
            )}

            {/* ── Image upload section ── */}
            {showImages && (
              <div>
                <p className="text-[11px] tracking-[.08em] uppercase mb-2" style={{ color: "var(--color-text-3)" }}>
                  Images {images.length > 0 ? `(${images.length}/20)` : "(up to 20)"}
                </p>

                {images.length < 20 && (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={e => e.preventDefault()}
                    onDrop={e => {
                      e.preventDefault();
                      const files = Array.from(e.dataTransfer.files)
                        .filter(f => f.type.startsWith("image/") && f.size <= 10 * 1024 * 1024);
                      const slots = 20 - images.length;
                      if (files.length > 0 && slots > 0) uploadImages(files.slice(0, slots));
                    }}
                    className="cursor-pointer flex flex-col items-center justify-center gap-2 rounded-[8px] transition-all"
                    style={{ border: "2px dashed var(--color-line)", height: 96, color: "var(--color-text-3)" }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = "var(--color-accent)"}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = "var(--color-line)"}
                  >
                    <UploadIcon />
                    <span className="text-[12px]">Drag images here or click to select</span>
                    <span className="text-[10px] tracking-[.06em] uppercase" style={{ opacity: 0.55 }}>Max 10 MB per image</span>
                  </div>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleFileInput}
                  className="hidden"
                />

                {images.length > 0 && (
                  <div className="grid gap-2 mt-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(80px, 1fr))" }}>
                    {images.map(img => (
                      <div key={img.localId} className="relative rounded-[6px] overflow-hidden" style={{ aspectRatio: "1", background: "var(--color-panel-2)" }}>
                        <img src={img.preview} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                        {img.status === "uploading" && (
                          <div className="absolute inset-0 flex items-center justify-center" style={{ background: "rgba(0,0,0,.5)" }}>
                            <svg className="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <path d="M21 12a9 9 0 1 1-6.22-8.56" strokeLinecap="round"/>
                            </svg>
                          </div>
                        )}
                        {img.status === "error" && (
                          <div className="absolute inset-0 flex items-center justify-center" style={{ background: "rgba(255,86,48,.3)" }}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-ember)" strokeWidth="2.5" strokeLinecap="round">
                              <path d="M12 9v4M12 17h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                            </svg>
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => removeImage(img.localId)}
                          className="absolute top-1 right-1 flex items-center justify-center rounded-full transition-all"
                          style={{ width: 20, height: 20, background: "rgba(0,0,0,.65)", color: "#fff" }}
                          onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "rgba(0,0,0,.9)"}
                          onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "rgba(0,0,0,.65)"}
                        >
                          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                            <path d="M18 6 6 18M6 6l12 12"/>
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── Tag picker ── */}
            <div>
              <p className="text-[11px] tracking-[.08em] uppercase mb-2" style={{ color: "var(--color-text-3)" }}>
                Tags {totalTagCount > 0 ? `(${totalTagCount}/5)` : "(up to 5)"}
              </p>

              {/* selected chips — existing tags + tags being created */}
              {(selected.length > 0 || newTags.length > 0) && (
                <div className="flex flex-wrap gap-[6px] mb-2">
                  {selected.map(tag => (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => toggleTag(tag)}
                      className="flex items-center gap-1 px-[9px] py-[4px] rounded-full text-[11px] font-medium transition-all"
                      style={{ background: "var(--color-accent)", color: "#fff" }}
                    >
                      {tag.name}
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                        <path d="M18 6 6 18M6 6l12 12" />
                      </svg>
                    </button>
                  ))}
                  {newTags.map(name => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => removeNewTag(name)}
                      title="New tag — will be created with this post"
                      className="flex items-center gap-1 px-[9px] py-[4px] rounded-full text-[11px] font-medium transition-all"
                      style={{ background: "var(--color-accent)", color: "#fff", border: "1px dashed rgba(255,255,255,.6)" }}
                    >
                      {name}
                      <span style={{ opacity: 0.75, fontWeight: 400 }}>new</span>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                        <path d="M18 6 6 18M6 6l12 12" />
                      </svg>
                    </button>
                  ))}
                </div>
              )}

              {/* search */}
              {totalTagCount < 5 && (
                <div
                  className="flex items-center gap-2 px-3 py-2 rounded-[6px] mb-2"
                  style={{ background: "var(--color-panel-2)", border: "1px solid var(--color-line)" }}
                >
                  <span style={{ color: "var(--color-text-3)" }}><SearchIcon /></span>
                  <input
                    type="text"
                    value={tagSearch}
                    onChange={e => setTagSearch(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === "Enter" && canCreateTag) { e.preventDefault(); createTag(); }
                    }}
                    placeholder="Search or create a tag…"
                    className="bg-transparent text-[13px] flex-1 outline-none"
                    style={{ color: "var(--color-text)" }}
                  />
                </div>
              )}

              {/* available chips + create-new option */}
              {totalTagCount < 5 && (
                <div className="flex flex-wrap gap-[6px]">
                  {canCreateTag && (
                    <button
                      type="button"
                      onClick={createTag}
                      className="flex items-center gap-1 px-[9px] py-[4px] rounded-full text-[11px] font-medium transition-all"
                      style={{ background: "var(--color-accent-soft)", color: "var(--color-accent)", border: "1px dashed var(--color-accent)" }}
                    >
                      <PlusIcon /> Create &ldquo;{tagSearch.trim()}&rdquo;
                    </button>
                  )}
                  {visibleTags.slice(0, 20).map(tag => (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => toggleTag(tag)}
                      className="px-[9px] py-[4px] rounded-full text-[11px] font-medium transition-all"
                      style={{ background: "var(--color-panel-2)", color: "var(--color-text-2)", border: "1px solid var(--color-line)" }}
                      onMouseEnter={e => { (e.currentTarget).style.borderColor = "var(--color-accent)"; (e.currentTarget).style.color = "var(--color-accent)"; }}
                      onMouseLeave={e => { (e.currentTarget).style.borderColor = "var(--color-line)"; (e.currentTarget).style.color = "var(--color-text-2)"; }}
                    >
                      {tag.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* ── Room picker — optional, defaults to global feed ── */}
            {rooms.length > 0 && (
              <div>
                <p className="text-[11px] tracking-[.08em] uppercase mb-2" style={{ color: "var(--color-text-3)" }}>
                  Post to
                </p>
                <select
                  value={roomId}
                  onChange={e => setRoomId(e.target.value)}
                  className="w-full rounded-[6px] text-[13px] px-3 py-[9px] outline-none appearance-none cursor-pointer"
                  style={{
                    background: "var(--color-panel-2)",
                    border: "1px solid var(--color-line)",
                    color: roomId ? "var(--color-text)" : "var(--color-text-3)",
                  }}
                >
                  <option value="">Global Feed</option>
                  {rooms.map(r => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* ── Flags ── */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] tracking-[.08em] uppercase mr-1" style={{ color: "var(--color-text-3)" }}>Flags</span>
              <Flag label="OC"      active={isOc}      onToggle={() => setIsOc(v => !v)} />
              <Flag label="Spoiler" active={isSpoiler} onToggle={() => setIsSpoiler(v => !v)} />
              <Flag label="NSFW"    active={isNsfw}    onToggle={() => setIsNsfw(v => !v)} />
            </div>

            {state?.error && (
              <p className="text-[13px]" style={{ color: "var(--color-ember)" }}>{state.error}</p>
            )}

            {/* ── Actions ── */}
            <div className="flex justify-end gap-3 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 rounded-[4px] text-[13px] font-medium transition-all"
                style={{ background: "transparent", color: "var(--color-text-2)", border: "1px solid var(--color-line)" }}
                onMouseEnter={e => (e.currentTarget).style.borderColor = "var(--color-text-3)"}
                onMouseLeave={e => (e.currentTarget).style.borderColor = "var(--color-line)"}
              >
                Cancel
              </button>
              <SubmitButton />
            </div>

          </form>
        </div>
      </div>
    </div>
  );
}
