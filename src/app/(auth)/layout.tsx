import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="fixed inset-0 grid"
      style={{ gridTemplateColumns: "1.05fr 1fr" }}
    >
      {/* ── Brand panel ── */}
      <div
        className="relative overflow-hidden flex flex-col justify-between p-14"
        style={{
          background: `
            radial-gradient(120% 90% at 0% 0%, rgba(255,46,126,.20), transparent 55%),
            radial-gradient(120% 120% at 100% 100%, rgba(90,40,120,.30), transparent 60%),
            linear-gradient(160deg,#150b14 0%,#0c0c10 70%)
          `,
        }}
      >
        {/* grid overlay */}
        <div
          className="absolute inset-0 pointer-events-none opacity-50"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,.06) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.06) 1px,transparent 1px)`,
            backgroundSize: "46px 46px",
            maskImage: "radial-gradient(70% 70% at 30% 20%,#000,transparent)",
          }}
        />

        {/* logo */}
        <Link href="/" className="relative z-10 flex items-center gap-3">
          <div
            className="grid place-items-center rounded-[9px] text-white font-bold text-xl flex-shrink-0"
            style={{
              width: 38, height: 38,
              background: "linear-gradient(150deg,var(--color-accent),#b3005c)",
              boxShadow: "0 8px 26px rgba(255,46,126,.35)",
            }}
          >
            S
          </div>
          <span className="font-semibold text-lg tracking-wide" style={{ color: "var(--color-text)" }}>SoDev</span>
        </Link>

        {/* hero copy */}
        <div className="relative z-10">
          <h1
            className="font-light leading-tight mb-4"
            style={{ fontSize: 46, letterSpacing: "-.01em", color: "var(--color-text)" }}
          >
            Where code<br />meets{" "}
            <span
              className="font-semibold"
              style={{
                background: "linear-gradient(110deg,#fff,var(--color-accent))",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              clout.
            </span>
          </h1>
          <p className="font-light text-[15px] leading-relaxed max-w-[30ch]" style={{ color: "var(--color-text-2)" }}>
            The developer community where your side projects actually matter. Post, get rated, earn clout, climb the ranks.
          </p>
        </div>

        {/* feature bullets */}
        <div className="relative z-10 flex flex-col gap-3">
          {[
            "Share projects & ideas — get real feedback",
            "Earn clout, unlock badges, top the leaderboard",
            "Join rooms and talk shop with other devs",
          ].map((f) => (
            <div key={f} className="flex items-center gap-3 text-[13.5px]" style={{ color: "var(--color-text-2)" }}>
              <span
                className="flex-shrink-0 rounded-full"
                style={{
                  width: 6, height: 6,
                  background: "var(--color-accent)",
                  boxShadow: "0 0 10px var(--color-accent)",
                }}
              />
              {f}
            </div>
          ))}
        </div>
      </div>

      {/* ── Form panel ── */}
      <div
        className="flex items-center justify-center p-10"
        style={{ background: "var(--color-bg)" }}
      >
        {children}
      </div>
    </div>
  );
}
