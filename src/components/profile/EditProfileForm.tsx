"use client";

import { useActionState, useRef, useState, KeyboardEvent } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { updateProfile } from "@/app/actions/profile";
import type { Profile, AvailabilityStatus } from "@/types";

// ── Icons ─────────────────────────────────────────────────────────────────────
const CheckIcon  = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>;
const CloseIcon  = () => <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>;
const UserIcon   = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="3.5"/><path d="M5 20c1.2-3.5 4-5 7-5s5.8 1.5 7 5"/></svg>;
const LinkIcon   = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>;
const StackIcon  = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="m12 2 10 6.5v7L12 22 2 15.5v-7L12 2z"/><path d="M12 22v-6.5"/><path d="m22 8.5-10 7-10-7"/></svg>;

// ── Popular tech suggestions ──────────────────────────────────────────────────
const TECH_SUGGESTIONS = [
  "React", "Next.js", "TypeScript", "JavaScript", "Python", "Rust",
  "Go", "Node.js", "PostgreSQL", "Docker", "AWS", "Tailwind",
  "Vue", "Swift", "Kotlin", "Java", "C++", "PHP", "Ruby",
  "GraphQL", "MongoDB", "Redis", "Linux", "Figma",
];

// ── Availability config ───────────────────────────────────────────────────────
const AVAILABILITY: { value: AvailabilityStatus; label: string; color: string; glow: string }[] = [
  { value: "available", label: "Available",   color: "#3fb950", glow: "rgba(63,185,80,.3)"   },
  { value: "busy",      label: "Busy",        color: "#f0883e", glow: "rgba(240,136,62,.3)"  },
  { value: "away",      label: "Away",        color: "#6c6c76", glow: "transparent"           },
];

// ── Section header ────────────────────────────────────────────────────────────
function Section({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-5 pb-3" style={{ borderBottom: "1px solid var(--color-line)" }}>
      <span style={{ color: "var(--color-text-3)" }}>{icon}</span>
      <h3 className="text-[12px] font-semibold tracking-[.1em] uppercase m-0" style={{ color: "var(--color-text-3)" }}>
        {title}
      </h3>
    </div>
  );
}

// ── Submit button ─────────────────────────────────────────────────────────────
function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex items-center gap-2 px-6 py-[10px] rounded-[6px] text-[13px] font-semibold text-white transition-all"
      style={{ background: "var(--color-accent)", opacity: pending ? 0.7 : 1 }}
    >
      {pending ? "Saving…" : <><CheckIcon /> Save Changes</>}
    </button>
  );
}

// ── Tech stack tag input ──────────────────────────────────────────────────────
function TechStackInput({ initial }: { initial: string[] }) {
  const [tags, setTags]     = useState<string[]>(initial);
  const [input, setInput]   = useState("");
  const inputRef            = useRef<HTMLInputElement>(null);

  function addTag(value: string) {
    const cleaned = value.trim();
    if (!cleaned || tags.includes(cleaned) || tags.length >= 20) return;
    setTags(prev => [...prev, cleaned]);
    setInput("");
  }

  function removeTag(tag: string) {
    setTags(prev => prev.filter(t => t !== tag));
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(input);
    }
    if (e.key === "Backspace" && !input && tags.length > 0) {
      removeTag(tags[tags.length - 1]);
    }
  }

  const suggestions = TECH_SUGGESTIONS.filter(s => !tags.includes(s));

  return (
    <div>
      {/* hidden field carries the value into FormData */}
      <input type="hidden" name="tech_stack" value={tags.join(",")} />

      {/* selected chips */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-[6px] mb-3">
          {tags.map(tag => (
            <span
              key={tag}
              className="flex items-center gap-[5px] px-[10px] py-[4px] rounded-full text-[12px] font-medium"
              style={{ background: "var(--color-accent)", color: "#fff" }}
            >
              {tag}
              <button
                type="button"
                onClick={() => removeTag(tag)}
                className="opacity-70 hover:opacity-100 transition-opacity"
              >
                <CloseIcon />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* text input */}
      <div
        className="flex items-center gap-2 px-3 py-2 rounded-[6px] mb-3"
        style={{ background: "var(--color-panel-2)", border: "1px solid var(--color-line)" }}
        onClick={() => inputRef.current?.focus()}
      >
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Type a technology, press Enter…"
          className="flex-1 bg-transparent text-[13.5px] outline-none"
          style={{ color: "var(--color-text)" }}
        />
        {input && (
          <button
            type="button"
            onClick={() => addTag(input)}
            className="text-[11px] px-2 py-1 rounded-[4px] font-medium transition-all"
            style={{ background: "var(--color-accent)", color: "#fff" }}
          >
            Add
          </button>
        )}
      </div>

      {/* suggestions */}
      <div className="flex flex-wrap gap-[6px]">
        {suggestions.slice(0, 16).map(s => (
          <button
            key={s}
            type="button"
            onClick={() => addTag(s)}
            className="px-[9px] py-[3px] rounded-full text-[11px] font-medium transition-all"
            style={{ background: "var(--color-panel-2)", color: "var(--color-text-2)", border: "1px solid var(--color-line)" }}
            onMouseEnter={e => { (e.currentTarget).style.borderColor = "var(--color-accent)"; (e.currentTarget).style.color = "var(--color-accent)"; }}
            onMouseLeave={e => { (e.currentTarget).style.borderColor = "var(--color-line)"; (e.currentTarget).style.color = "var(--color-text-2)"; }}
          >
            + {s}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Main form ─────────────────────────────────────────────────────────────────
interface Props { profile: Profile }

export default function EditProfileForm({ profile }: Props) {
  const [state, action] = useActionState(updateProfile, null);
  const [availability, setAvailability] = useState<AvailabilityStatus>(profile.availability_status);

  return (
    <form action={action} className="flex flex-col gap-8">

      {/* ── Success banner ── */}
      {state?.success && (
        <div
          className="flex items-center justify-between px-4 py-3 rounded-[8px] text-[13px]"
          style={{ background: "rgba(63,185,80,.12)", border: "1px solid rgba(63,185,80,.3)", color: "#3fb950" }}
        >
          <span className="flex items-center gap-2"><CheckIcon /> Profile saved.</span>
          <Link
            href={`/u/${state.username}`}
            className="font-semibold underline"
            style={{ color: "#3fb950" }}
          >
            View profile
          </Link>
        </div>
      )}

      {/* ── Error banner ── */}
      {state?.error && (
        <div
          className="px-4 py-3 rounded-[8px] text-[13px]"
          style={{ background: "rgba(255,86,48,.12)", border: "1px solid rgba(255,86,48,.3)", color: "var(--color-ember)" }}
        >
          {state.error}
        </div>
      )}

      {/* ══ Identity ══ */}
      <section>
        <Section icon={<UserIcon />} title="Identity" />

        <div className="flex flex-col gap-4">
          <div className="field">
            <input
              id="display_name"
              name="display_name"
              type="text"
              placeholder=" "
              defaultValue={profile.display_name ?? ""}
              maxLength={50}
            />
            <label htmlFor="display_name">Display Name</label>
          </div>

          <div className="field">
            <input
              id="title"
              name="title"
              type="text"
              placeholder=" "
              defaultValue={profile.title ?? ""}
              maxLength={60}
            />
            <label htmlFor="title">Title — shown under your name</label>
          </div>

          <div className="field" style={{ height: "auto" }}>
            <textarea
              id="bio"
              name="bio"
              placeholder=" "
              defaultValue={profile.bio ?? ""}
              rows={3}
              maxLength={280}
              style={{
                background: "transparent",
                border: "none",
                outline: "none",
                resize: "none",
                width: "100%",
                color: "var(--color-text)",
                fontSize: 13.5,
                paddingTop: 20,
                paddingBottom: 8,
                lineHeight: 1.6,
              }}
            />
            <label htmlFor="bio">Bio</label>
          </div>

          {/* Availability */}
          <div>
            <p className="text-[11px] tracking-[.1em] uppercase font-semibold mb-2" style={{ color: "var(--color-text-3)" }}>
              Availability
            </p>
            <input type="hidden" name="availability_status" value={availability} />
            <div className="flex gap-2">
              {AVAILABILITY.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setAvailability(opt.value)}
                  className="flex items-center gap-[7px] px-4 py-2 rounded-[6px] text-[13px] font-medium transition-all"
                  style={
                    availability === opt.value
                      ? { background: `rgba(${opt.color === "#3fb950" ? "63,185,80" : opt.color === "#f0883e" ? "240,136,62" : "108,108,118"},.15)`, border: `1px solid ${opt.color}`, color: opt.color }
                      : { background: "var(--color-panel-2)", border: "1px solid var(--color-line)", color: "var(--color-text-3)" }
                  }
                >
                  <span
                    className="rounded-full flex-shrink-0"
                    style={{
                      width: 8, height: 8,
                      background: opt.color,
                      boxShadow: availability === opt.value ? `0 0 6px ${opt.color}` : "none",
                    }}
                  />
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ══ Links ══ */}
      <section>
        <Section icon={<LinkIcon />} title="Links" />

        <div className="flex flex-col gap-4">
          <div className="field">
            <input
              id="location"
              name="location"
              type="text"
              placeholder=" "
              defaultValue={profile.location ?? ""}
              maxLength={60}
            />
            <label htmlFor="location">Location</label>
          </div>

          <div className="field">
            <input
              id="website"
              name="website"
              type="url"
              placeholder=" "
              defaultValue={profile.website ?? ""}
            />
            <label htmlFor="website">Website</label>
          </div>

          <div className="field">
            <input
              id="github_url"
              name="github_url"
              type="url"
              placeholder=" "
              defaultValue={profile.github_url ?? ""}
            />
            <label htmlFor="github_url">GitHub URL</label>
          </div>
        </div>
      </section>

      {/* ══ Tech stack ══ */}
      <section>
        <Section icon={<StackIcon />} title="Tech Stack" />
        <TechStackInput initial={profile.tech_stack ?? []} />
      </section>

      {/* ── Footer actions ── */}
      <div className="flex items-center gap-3 pt-2">
        <SaveButton />
        <Link
          href={`/u/${profile.username}`}
          className="px-5 py-[10px] rounded-[6px] text-[13px] font-medium transition-all"
          style={{ border: "1px solid var(--color-line)", color: "var(--color-text-2)" }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--color-text-3)"; (e.currentTarget as HTMLElement).style.color = "var(--color-text)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--color-line)"; (e.currentTarget as HTMLElement).style.color = "var(--color-text-2)"; }}
        >
          Cancel
        </Link>
      </div>

    </form>
  );
}
