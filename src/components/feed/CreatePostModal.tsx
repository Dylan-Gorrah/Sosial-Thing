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

// ── Format config ─────────────────────────────────────────────────────────────
const FORMATS = [
  { value: "text",     label: "Text"     },
  { value: "link",     label: "Link"     },
  { value: "media",    label: "Images"   },
  { value: "showcase", label: "Showcase" },
] as const;
type Format = typeof FORMATS[number]["value"];

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

// ── Main component ────────────────────────────────────────────────────────────
interface Props { open: boolean; onClose: () => void; }

export default function CreatePostModal({ open, onClose }: Props) {
  const router = useRouter();
  const [state, action] = useActionState(createPost, null);
  const formRef = useRef<HTMLFormElement>(null);

  const [format, setFormat]       = useState<Format>("text");
  const [allTags, setAllTags]     = useState<Tag[]>([]);
  const [tagSearch, setTagSearch] = useState("");
  const [selected, setSelected]   = useState<Tag[]>([]);
  const [isNsfw, setIsNsfw]       = useState(false);
  const [isSpoiler, setIsSpoiler] = useState(false);
  const [isOc, setIsOc]           = useState(false);
  const [rooms, setRooms]         = useState<Pick<Room, "id" | "name">[]>([]);
  const [roomId, setRoomId]       = useState<string>("");
  const [images, setImages]       = useState<ImageState[]>([]);
  const [userId, setUserId]       = useState<string | null>(null);
  const [linkUrl, setLinkUrl]     = useState("");
  const fileInputRef              = useRef<HTMLInputElement>(null);

  const linkEmbed = format === "link" ? detectEmbed(linkUrl) : null;

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

  // Reset and close on success
  useEffect(() => {
    if (!state?.success) return;
    formRef.current?.reset();
    setFormat("text");
    setSelected([]);
    setTagSearch("");
    setIsNsfw(false);
    setIsSpoiler(false);
    setIsOc(false);
    setRoomId("");
    setLinkUrl("");
    images.forEach(img => URL.revokeObjectURL(img.preview));
    setImages([]);
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

  // Escape to close
  useEffect(() => {
    if (!open) return;
    const fn = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [open, onClose]);

  if (!open) return null;

  const visibleTags = allTags.filter(
    t => !selected.find(s => s.id === t.id) &&
         t.name.toLowerCase().includes(tagSearch.toLowerCase())
  );

  function toggleTag(tag: Tag) {
    setSelected(prev => {
      if (prev.find(t => t.id === tag.id)) return prev.filter(t => t.id !== tag.id);
      if (prev.length >= 5) return prev;
      return [...prev, tag];
    });
  }

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
          <h2 className="text-[15px] font-semibold" style={{ color: "var(--color-text)" }}>
            New Post
          </h2>
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

            {/* hidden fields */}
            <input type="hidden" name="format"     value={format} />
            <input type="hidden" name="tag_ids"    value={selected.map(t => t.id).join(",")} />
            <input type="hidden" name="is_nsfw"    value={isNsfw    ? "1" : "0"} />
            <input type="hidden" name="is_spoiler" value={isSpoiler ? "1" : "0"} />
            <input type="hidden" name="is_oc"      value={isOc      ? "1" : "0"} />
            <input type="hidden" name="room_id"    value={roomId} />
            {format === "media" && (
              <input type="hidden" name="images" value={JSON.stringify(
                images.filter(i => i.status === "done").map(i => ({ path: i.path!, url: i.url! }))
              )} />
            )}

            {/* ── Format tabs ── */}
            <div className="flex gap-2">
              {FORMATS.map(f => (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => setFormat(f.value)}
                  className="px-4 py-1.5 rounded-full text-[12px] font-medium tracking-wide transition-all"
                  style={
                    format === f.value
                      ? { background: "var(--color-accent)", color: "#fff" }
                      : { background: "var(--color-panel-2)", color: "var(--color-text-2)", border: "1px solid var(--color-line)" }
                  }
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* ── Title ── */}
            <div className="field">
              <input id="cp-title" name="title" type="text" placeholder=" " required maxLength={120} />
              <label htmlFor="cp-title">Title</label>
            </div>

            {/* ── Link URL (link format only) ── */}
            {format === "link" && (
              <div className="flex flex-col gap-3">
                <div className="field">
                  <input
                    id="cp-link"
                    name="link_url"
                    type="url"
                    placeholder=" "
                    required
                    value={linkUrl}
                    onChange={e => setLinkUrl(e.target.value)}
                  />
                  <label htmlFor="cp-link">URL</label>
                </div>
                {linkEmbed && (
                  <div className="rounded-[8px] overflow-hidden" style={{ border: "1px solid var(--color-line)" }}>
                    <VideoPlayer embed={linkEmbed} />
                  </div>
                )}
              </div>
            )}

            {/* ── Showcase fields ── */}
            {format === "showcase" && (
              <div className="flex flex-col gap-4">
                <div className="field">
                  <input id="cp-repo" name="repo_url" type="url" placeholder=" " />
                  <label htmlFor="cp-repo">GitHub / Repo URL (optional)</label>
                </div>
                <div className="field">
                  <input id="cp-demo" name="demo_url" type="url" placeholder=" " />
                  <label htmlFor="cp-demo">Live Demo URL (optional)</label>
                </div>
              </div>
            )}

            {/* ── Image upload (media format only) ── */}
            {format === "media" && (
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

            {/* ── Body (all formats except link where it's optional) ── */}
            <div
              className="field"
              style={{ height: "auto", paddingTop: 0, paddingBottom: 0 }}
            >
              <textarea
                id="cp-body"
                name="body_md"
                placeholder=" "
                rows={4}
                required={format !== "link" && format !== "showcase" && format !== "media"}
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
                {format === "link" ? "Comment (optional)" : format === "media" ? "Caption (optional)" : "Description"}
              </label>
            </div>

            {/* ── Tag picker ── */}
            <div>
              <p className="text-[11px] tracking-[.08em] uppercase mb-2" style={{ color: "var(--color-text-3)" }}>
                Tags {selected.length > 0 ? `(${selected.length}/5)` : "(up to 5)"}
              </p>

              {/* selected chips */}
              {selected.length > 0 && (
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
                </div>
              )}

              {/* search */}
              {selected.length < 5 && (
                <div
                  className="flex items-center gap-2 px-3 py-2 rounded-[6px] mb-2"
                  style={{ background: "var(--color-panel-2)", border: "1px solid var(--color-line)" }}
                >
                  <span style={{ color: "var(--color-text-3)" }}><SearchIcon /></span>
                  <input
                    type="text"
                    value={tagSearch}
                    onChange={e => setTagSearch(e.target.value)}
                    placeholder="Search tags…"
                    className="bg-transparent text-[13px] flex-1 outline-none"
                    style={{ color: "var(--color-text)" }}
                  />
                </div>
              )}

              {/* available chips */}
              {selected.length < 5 && (
                <div className="flex flex-wrap gap-[6px]">
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
