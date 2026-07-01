"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { register } from "@/app/actions/auth";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full py-3 rounded-[4px] text-[13.5px] font-semibold tracking-wide text-white transition-all"
      style={{ background: "var(--color-accent)", opacity: pending ? 0.7 : 1 }}
      onMouseEnter={e => !pending && ((e.target as HTMLElement).style.filter = "brightness(1.08)")}
      onMouseLeave={e => ((e.target as HTMLElement).style.filter = "")}
    >
      {pending ? "Creating account…" : "Create Account"}
    </button>
  );
}

export default function RegisterPage() {
  const [state, action] = useActionState(register, null);

  /* ── Email confirmation screen ── */
  if (state && "success" in state && state.success) {
    return (
      <div className="w-full max-w-[360px] text-center" style={{ animation: "rise .3s ease both" }}>
        <div
          className="mx-auto mb-6 grid place-items-center rounded-full"
          style={{
            width: 64, height: 64,
            background: "var(--color-accent-soft)",
            color: "var(--color-accent)",
            fontSize: 28,
          }}
        >
          ✉️
        </div>
        <h2
          className="font-light text-[26px] mb-3"
          style={{ letterSpacing: "-.01em", color: "var(--color-text)" }}
        >
          Check your email
        </h2>
        <p className="text-[14px] leading-relaxed mb-1" style={{ color: "var(--color-text-2)" }}>
          We sent a confirmation link to
        </p>
        <p className="text-[14px] font-semibold mb-6" style={{ color: "var(--color-text)" }}>
          {"email" in state ? state.email as string : "your inbox"}
        </p>
        <p className="text-[13px] leading-relaxed mb-8" style={{ color: "var(--color-text-3)" }}>
          Click the link in the email to activate your account, then come back here and sign in.
        </p>
        <Link
          href="/login"
          className="block w-full py-3 rounded-[4px] text-[13.5px] font-semibold tracking-wide text-white text-center"
          style={{ background: "var(--color-accent)" }}
        >
          Go to Sign In
        </Link>
        <p className="mt-5 text-[12px]" style={{ color: "var(--color-text-3)" }}>
          Didn't get it? Check your spam folder.
        </p>
      </div>
    );
  }

  /* ── Register form ── */
  return (
    <div className="w-full max-w-[360px]">
      <span
        className="block mb-2 text-[11px] tracking-[.10em] uppercase"
        style={{ color: "var(--color-text-3)" }}
      >
        Join the community
      </span>
      <h2
        className="font-light text-[28px] mb-8"
        style={{ letterSpacing: "-.01em", color: "var(--color-text)" }}
      >
        Create your account
      </h2>

      <form action={action} className="flex flex-col">
        <div className="field">
          <input id="username" name="username" type="text" placeholder=" " required minLength={3} maxLength={20} pattern="[a-zA-Z0-9_]+" />
          <label htmlFor="username">Username</label>
        </div>
        <div className="field">
          <input id="email" name="email" type="email" placeholder=" " required />
          <label htmlFor="email">Email</label>
        </div>
        <div className="field">
          <input id="pw" name="password" type="password" placeholder=" " required minLength={6} />
          <label htmlFor="pw">Password</label>
        </div>

        {state?.error && (
          <p className="text-[13px] mb-3 mt-[-8px]" style={{ color: "var(--color-ember)" }}>
            {state.error}
          </p>
        )}

        <SubmitButton />

        <div className="flex items-center gap-3 my-5 text-[11px] tracking-[.1em]" style={{ color: "var(--color-text-3)" }}>
          <span className="flex-1 h-px" style={{ background: "var(--color-line)" }} />
          OR
          <span className="flex-1 h-px" style={{ background: "var(--color-line)" }} />
        </div>

        <button
          type="button"
          className="w-full py-3 rounded-[4px] text-[13.5px] font-medium flex items-center justify-center gap-2 transition-all"
          style={{ background: "transparent", border: "1px solid var(--color-line-2)", color: "var(--color-text)" }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--color-text-3)"; e.currentTarget.style.background = "var(--color-panel)"; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--color-line-2)"; e.currentTarget.style.background = "transparent"; }}
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 .5C5.7.5.5 5.7.5 12c0 5.1 3.3 9.4 7.9 10.9.6.1.8-.2.8-.5v-2c-3.2.7-3.9-1.4-3.9-1.4-.5-1.3-1.3-1.7-1.3-1.7-1.1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.7 1.3 3.4 1 .1-.7.4-1.3.7-1.6-2.6-.3-5.3-1.3-5.3-5.7 0-1.3.4-2.3 1.2-3.1-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.3 1.2 1-.3 2-.4 3-.4s2 .1 3 .4c2.3-1.5 3.3-1.2 3.3-1.2.6 1.6.2 2.8.1 3.1.8.8 1.2 1.8 1.2 3.1 0 4.4-2.7 5.4-5.3 5.7.4.4.8 1.1.8 2.2v3.3c0 .3.2.6.8.5 4.6-1.5 7.9-5.8 7.9-10.9C23.5 5.7 18.3.5 12 .5z" />
          </svg>
          Sign up with GitHub
        </button>

        <p className="mt-6 text-[13px] text-center" style={{ color: "var(--color-text-2)" }}>
          Already have an account?{" "}
          <Link href="/login" style={{ color: "var(--color-accent)" }}>
            Sign in
          </Link>
        </p>
      </form>
    </div>
  );
}
