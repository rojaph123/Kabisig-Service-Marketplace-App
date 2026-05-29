import type { Metadata } from "next";
import Link from "next/link";
import { KABISIG_PRIVACY_NOTICE_VERSION, KABISIG_TERMS_VERSION, kabisigPrivacyNoticeSections, kabisigTermsSections } from "@kabisig/shared/src/legal";

export const metadata: Metadata = {
  title: "Kabisig Terms and Privacy Notice",
  description: "Kabisig platform terms, agreement, and privacy notice for customers, workers, and admins."
};

export default function TermsPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-8 px-5 py-10 sm:px-8">
      <header className="rounded-[2rem] border border-kabisig-border bg-white/88 p-6 shadow-xl shadow-slate-900/5 dark:bg-slate-950/70">
        <p className="text-sm font-black uppercase tracking-[0.24em] text-kabisig-blue">Kabisig Legal</p>
        <h1 className="mt-3 text-3xl font-black text-kabisig-text">Terms and Agreement</h1>
        <p className="mt-3 text-sm leading-6 text-kabisig-muted">
          Version {KABISIG_TERMS_VERSION}. These terms apply to Kabisig customers, workers, and admins.
        </p>
        <div className="mt-4 flex flex-wrap gap-3 text-sm font-bold">
          <Link className="rounded-full bg-kabisig-blue px-4 py-2 text-white" href="/privacy">Privacy Notice</Link>
          <Link className="rounded-full border border-kabisig-border px-4 py-2 text-kabisig-text" href="/data-deletion">Data deletion</Link>
          <Link className="rounded-full border border-kabisig-border px-4 py-2 text-kabisig-text" href="/support">Support</Link>
        </div>
      </header>

      <section className="space-y-5 rounded-[2rem] border border-kabisig-border bg-white/88 p-6 shadow-xl shadow-slate-900/5 dark:bg-slate-950/70">
        {kabisigTermsSections.map((section) => (
          <article key={section.title} className="space-y-2 border-b border-kabisig-border pb-5 last:border-b-0 last:pb-0">
            <h2 className="text-lg font-black text-kabisig-text">{section.title}</h2>
            <p className="text-sm leading-7 text-kabisig-muted">{section.body}</p>
          </article>
        ))}
      </section>

      <section className="space-y-5 rounded-[2rem] border border-kabisig-border bg-white/88 p-6 shadow-xl shadow-slate-900/5 dark:bg-slate-950/70">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.24em] text-kabisig-blue">Also included</p>
          <h2 className="mt-2 text-2xl font-black text-kabisig-text">Privacy Notice</h2>
          <p className="mt-2 text-sm text-kabisig-muted">Version {KABISIG_PRIVACY_NOTICE_VERSION}</p>
        </div>
        {kabisigPrivacyNoticeSections.map((section) => (
          <article key={section.title} className="space-y-2 border-b border-kabisig-border pb-5 last:border-b-0 last:pb-0">
            <h3 className="text-base font-black text-kabisig-text">{section.title}</h3>
            <p className="text-sm leading-7 text-kabisig-muted">{section.body}</p>
          </article>
        ))}
      </section>
    </main>
  );
}
