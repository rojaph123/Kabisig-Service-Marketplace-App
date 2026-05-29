import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Kabisig Support",
  description: "Support contact and reviewer help for the Kabisig service marketplace."
};

export default function SupportPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-8 px-5 py-10 sm:px-8">
      <header className="rounded-[2rem] border border-kabisig-border bg-white/88 p-6 shadow-xl shadow-slate-900/5 dark:bg-slate-950/70">
        <p className="text-sm font-black uppercase tracking-[0.24em] text-kabisig-blue">Kabisig Help</p>
        <h1 className="mt-3 text-3xl font-black text-kabisig-text">Support</h1>
        <p className="mt-3 text-sm leading-6 text-kabisig-muted">
          For account, booking, worker application, commission payment, privacy, or complaint concerns, contact Kabisig support.
        </p>
        <div className="mt-4 flex flex-wrap gap-3 text-sm font-bold">
          <a className="rounded-full bg-kabisig-blue px-4 py-2 text-white" href="mailto:support@kabisig.app?subject=Kabisig%20Support">Email support</a>
          <Link className="rounded-full border border-kabisig-border px-4 py-2 text-kabisig-text" href="/terms">Terms</Link>
          <Link className="rounded-full border border-kabisig-border px-4 py-2 text-kabisig-text" href="/privacy">Privacy</Link>
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-2">
        {[
          ["Support email", "support@kabisig.app"],
          ["Common issues", "Bookings, worker approval, payment proof, commission billing, reviews, complaints, and account access."],
          ["Reviewer access", "Store reviewers should use the demo accounts provided in the app review notes."],
          ["Response note", "Support requests may require account, booking, payment, or identity details so the admin can verify the concern."]
        ].map(([title, body]) => (
          <article key={title} className="rounded-[2rem] border border-kabisig-border bg-white/88 p-6 shadow-xl shadow-slate-900/5 dark:bg-slate-950/70">
            <h2 className="text-lg font-black text-kabisig-text">{title}</h2>
            <p className="mt-2 text-sm leading-7 text-kabisig-muted">{body}</p>
          </article>
        ))}
      </section>
    </main>
  );
}
