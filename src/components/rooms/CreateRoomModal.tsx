"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { createRoom } from "@/app/actions/rooms";

const CloseIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>;

function SubmitBtn() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="px-6 py-[9px] rounded-[6px] text-[13px] font-semibold text-white transition-all" style={{ background: "var(--color-accent)", opacity: pending ? 0.7 : 1 }}>
      {pending ? "Creating…" : "Create Room"}
    </button>
  );
}

interface Props { open: boolean; onClose: () => void; }

export default function CreateRoomModal({ open, onClose }: Props) {
  const [state, action] = useActionState(createRoom, null);
  const [roomType, setRoomType] = useState<"public" | "private">("public");

  // The server action redirects to the new room on success, so no explicit
  // close-on-success is needed — the user is taken there automatically.

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" onClick={onClose} />

      <div className="relative w-full max-w-[520px] rounded-[12px] overflow-hidden" style={{ background: "var(--color-panel)", border: "1px solid var(--color-line)" }}>
        {/* header */}
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid var(--color-line)" }}>
          <h2 className="text-[15px] font-semibold m-0" style={{ color: "var(--color-text)" }}>Create a Room</h2>
          <button onClick={onClose} className="grid place-items-center rounded-[6px] transition-all" style={{ width: 30, height: 30, color: "var(--color-text-3)" }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--color-panel-2)"; (e.currentTarget as HTMLElement).style.color = "var(--color-text)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = "var(--color-text-3)"; }}
          >
            <CloseIcon />
          </button>
        </div>

        <form action={action} className="flex flex-col gap-5 p-6">
          {/* Name */}
          <div>
            <div className="field">
              <input id="rm-name" name="name" type="text" placeholder=" " required maxLength={30}
                pattern="[a-zA-Z0-9\s\-]+"
                title="Letters, numbers, spaces and hyphens only"
              />
              <label htmlFor="rm-name">Room Name</label>
            </div>
            <p className="text-[11px] mt-1" style={{ color: "var(--color-text-3)" }}>
              Letters, numbers and hyphens only · becomes the URL slug
            </p>
          </div>

          {/* Description */}
          <div className="field" style={{ height: "auto" }}>
            <textarea id="rm-desc" name="description" placeholder=" " rows={3} maxLength={280}
              style={{ background: "transparent", border: "none", outline: "none", resize: "none", width: "100%", color: "var(--color-text)", fontSize: 13.5, paddingTop: 20, paddingBottom: 8, lineHeight: 1.6 }}
            />
            <label htmlFor="rm-desc">Description (optional)</label>
          </div>

          {/* Type */}
          <div>
            <p className="text-[11px] tracking-[.08em] uppercase mb-2" style={{ color: "var(--color-text-3)" }}>Visibility</p>
            {/* State-driven buttons + a hidden input. The old version used sr-only
                radios with a has-[:checked] class, but the inline border style
                overrode the class — clicks worked, the highlight never showed. */}
            <input type="hidden" name="type" value={roomType} />
            <div className="flex gap-2">
              {(["public", "private"] as const).map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setRoomType(t)}
                  className="flex items-center gap-2 px-4 py-[8px] rounded-[6px] cursor-pointer text-[13px] font-medium transition-all"
                  style={
                    roomType === t
                      ? { border: "1px solid var(--color-accent)", background: "var(--color-accent-soft)", color: "var(--color-accent)" }
                      : { border: "1px solid var(--color-line)", background: "transparent", color: "var(--color-text-2)" }
                  }
                >
                  <span
                    className="rounded-full"
                    style={{
                      width: 8, height: 8, flexShrink: 0,
                      background: roomType === t ? "var(--color-accent)" : "var(--color-line)",
                    }}
                  />
                  <span className="capitalize">{t}</span>
                </button>
              ))}
            </div>
            <p className="text-[11px] mt-2 mb-0" style={{ color: "var(--color-text-3)" }}>
              {roomType === "public"
                ? "Anyone can find and join this room."
                : "Hidden from browsing — people join with an invite link only."}
            </p>
          </div>

          {state?.error && (
            <p className="text-[13px]" style={{ color: "var(--color-ember)" }}>{state.error}</p>
          )}

          <div className="flex justify-end gap-3 pt-1">
            <button type="button" onClick={onClose} className="px-5 py-[9px] rounded-[6px] text-[13px] font-medium transition-all"
              style={{ border: "1px solid var(--color-line)", color: "var(--color-text-2)" }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = "var(--color-text-3)"}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = "var(--color-line)"}
            >
              Cancel
            </button>
            <SubmitBtn />
          </div>
        </form>
      </div>
    </div>
  );
}
