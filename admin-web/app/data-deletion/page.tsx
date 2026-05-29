import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Kabisig Data Deletion Instructions",
  description: "How Kabisig users can request account and personal data deletion."
};

const deletionSteps = [
  "Open the Kabisig app and go to Profile > Help, or email support@kabisig.app from the email address linked to your Kabisig account.",
  "Use the subject line: Data deletion request.",
  "Include your full name, account email, role (customer or worker), and a short request asking Kabisig to delete or deactivate your account data.",
  "Kabisig may ask you to verify account ownership before processing the request.",
  "After verification, Kabisig will delete or deactivate account data that is no longer needed for active bookings, payment records, commission billing, complaints, fraud prevention, accounting, safety, or legal obligations."
];

export default function DataDeletionPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-8 px-5 py-10 sm:px-8">
      <header className="rounded-[2rem] border border-kabisig-border bg-white/88 p-6 shadow-xl shadow-slate-900/5 dark:bg-slate-950/70">
        <p className="text-sm font-black uppercase tracking-[0.24em] text-kabisig-blue">Kabisig Privacy</p>
        <h1 className="mt-3 text-3xl font-black text-kabisig-text">Data Deletion Instructions</h1>
        <p className="mt-3 text-sm leading-6 text-kabisig-muted">
          Use these steps to request deletion, correction, blocking, or deactivation of your Kabisig account data.
        </p>
        <div className="mt-4 flex flex-wrap gap-3 text-sm font-bold">
          <Link className="rounded-full bg-kabisig-blue px-4 py-2 text-white" href="/privacy">Privacy Notice</Link>
          <Link className="rounded-full border border-kabisig-border px-4 py-2 text-kabisig-text" href="/terms">Terms</Link>
          <Link className="rounded-full border border-kabisig-border px-4 py-2 text-kabisig-text" href="/support">Support</Link>
        </div>
      </header>

      <section className="rounded-[2rem] border border-kabisig-border bg-white/88 p-6 shadow-xl shadow-slate-900/5 dark:bg-slate-950/70">
        <h2 className="text-xl font-black text-kabisig-text">How to request deletion</h2>
        <ol className="mt-5 space-y-4">
          {deletionSteps.map((step, index) => (
            <li key={step} className="flex gap-3 text-sm leading-7 text-kabisig-muted">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-kabisig-blue text-xs font-black text-white">{index + 1}</span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
        <div className="mt-6 rounded-3xl border border-kabisig-border bg-slate-50 p-5 text-sm leading-7 text-kabisig-muted dark:bg-white/5">
          Some records may be retained when necessary for unresolved bookings, worker commission billing, proof of payment review, customer complaints, safety investigations, legal compliance, accounting, fraud prevention, or audit history.
        </div>
      </section>
    </main>
  );
}
