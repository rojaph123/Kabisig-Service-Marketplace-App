import type { Metadata } from "next";
import Link from "next/link";
import { KABISIG_PRIVACY_NOTICE_VERSION, kabisigPrivacyNoticeSections } from "@kabisig/shared/src/legal";

export const metadata: Metadata = {
  title: "Kabisig Privacy Notice",
  description: "How Kabisig collects, uses, stores, shares, protects, and retains user data."
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-8 px-5 py-10 sm:px-8">
      <header className="rounded-[2rem] border border-kabisig-border bg-white/88 p-6 shadow-xl shadow-slate-900/5 dark:bg-slate-950/70">
        <p className="text-sm font-black uppercase tracking-[0.24em] text-kabisig-blue">Kabisig Legal</p>
        <h1 className="mt-3 text-3xl font-black text-kabisig-text">Privacy Notice</h1>
        <p className="mt-3 text-sm leading-6 text-kabisig-muted">
          Version {KABISIG_PRIVACY_NOTICE_VERSION}. This notice explains how Kabisig handles information for customers, workers, and admins.
        </p>
        <div className="mt-4 flex flex-wrap gap-3 text-sm font-bold">
          <Link className="rounded-full bg-kabisig-blue px-4 py-2 text-white" href="/terms">Terms</Link>
          <Link className="rounded-full border border-kabisig-border px-4 py-2 text-kabisig-text" href="/data-deletion">Data deletion</Link>
          <Link className="rounded-full border border-kabisig-border px-4 py-2 text-kabisig-text" href="/support">Support</Link>
        </div>
      </header>

      <section className="space-y-5 rounded-[2rem] border border-kabisig-border bg-white/88 p-6 shadow-xl shadow-slate-900/5 dark:bg-slate-950/70">
        {kabisigPrivacyNoticeSections.map((section) => (
          <article key={section.title} className="space-y-2 border-b border-kabisig-border pb-5 last:border-b-0 last:pb-0">
            <h2 className="text-lg font-black text-kabisig-text">{section.title}</h2>
            <p className="text-sm leading-7 text-kabisig-muted">{section.body}</p>
          </article>
        ))}
      </section>
    </main>
  );
}
