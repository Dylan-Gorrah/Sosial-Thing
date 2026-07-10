"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { login } from "@/app/actions/auth";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full py-3 rounded-[4px] text-[13.5px] font-semibold tracking-wide text-white transition-all"
      style={{
        background: "var(--color-accent)",
        opacity: pending ? 0.7 : 1,
        filter: pending ? "none" : undefined,
      }}
      onMouseEnter={e => !pending && ((e.target as HTMLElement).style.filter = "brightness(1.08)")}
      onMouseLeave={e => ((e.target as HTMLElement).style.filter = "")}
    >
      {pending ? "Signing in…" : "Sign In"}
    </button>
  );
}

export default function LoginForm({ next }: { next?: string }) {
  const [state, action] = useActionState(login, null);

  return (
    <div className="w-full max-w-[360px]">
      <span
        className="block mb-2 text-[11px] tracking-[.10em] uppercase"
        style={{ color: "var(--color-text-3)" }}
      >
        Welcome back
      </span>
      <h2
        className="font-light text-[28px] mb-8"
        style={{ letterSpacing: "-.01em", color: "var(--color-text)" }}
      >
        Sign in to SoDev
      </h2>

      <form action={action} className="flex flex-col">
        {next && <input type="hidden" name="next" value={next} />}
        <div className="field">
          <input id="username" name="username" type="text" placeholder=" " required autoComplete="username" autoCapitalize="none" />
          <label htmlFor="username">Username</label>
        </div>
        <div className="field">
          <input id="pw" name="password" type="password" placeholder=" " required />
          <label htmlFor="pw">Password</label>
        </div>

        {state?.error && (
          <p className="text-[13px] mb-3 mt-[-8px]" style={{ color: "var(--color-ember)" }}>
            {state.error}
          </p>
        )}

        <SubmitButton />

        {/* OR divider */}
        <div
          className="flex items-center gap-3 my-5 text-[11px] tracking-[.1em]"
          style={{ color: "var(--color-text-3)" }}
        >
          <span className="flex-1 h-px" style={{ background: "var(--color-line)" }} />
          OR
          <span className="flex-1 h-px" style={{ background: "var(--color-line)" }} />
        </div>

        {/* GitHub — cosmetic for now */}
        <button
          type="button"
          className="w-full py-3 rounded-[4px] text-[13.5px] font-medium flex items-center justify-center gap-2 transition-all"
          style={{
            background: "transparent",
            border: "1px solid var(--color-line-2)",
            color: "var(--color-text)",
          }}
          onMouseEnter={e => {
            const el = e.currentTarget;
            el.style.borderColor = "var(--color-text-3)";
            el.style.background  = "var(--color-panel)";
          }}
          onMouseLeave={e => {
            const el = e.currentTarget;
            el.style.borderColor = "var(--color-line-2)";
            el.style.background  = "transparent";
          }}
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 .5C5.7.5.5 5.7.5 12c0 5.1 3.3 9.4 7.9 10.9.6.1.8-.2.8-.5v-2c-3.2.7-3.9-1.4-3.9-1.4-.5-1.3-1.3-1.7-1.3-1.7-1.1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.7 1.3 3.4 1 .1-.7.4-1.3.7-1.6-2.6-.3-5.3-1.3-5.3-5.7 0-1.3.4-2.3 1.2-3.1-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.3 1.2 1-.3 2-.4 3-.4s2 .1 3 .4c2.3-1.5 3.3-1.2 3.3-1.2.6 1.6.2 2.8.1 3.1.8.8 1.2 1.8 1.2 3.1 0 4.4-2.7 5.4-5.3 5.7.4.4.8 1.1.8 2.2v3.3c0 .3.2.6.8.5 4.6-1.5 7.9-5.8 7.9-10.9C23.5 5.7 18.3.5 12 .5z" />
          </svg>
          Continue with GitHub
        </button>

        <p className="mt-6 text-[13px] text-center" style={{ color: "var(--color-text-2)" }}>
          New to SoDev?{" "}
          <Link href="/register" style={{ color: "var(--color-accent)" }}>
            Create an account
          </Link>
        </p>
      </form>
    </div>
  );
}
