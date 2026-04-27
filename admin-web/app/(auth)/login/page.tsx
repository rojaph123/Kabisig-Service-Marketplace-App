"use client";

import { ShieldCheck } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAdminAuth } from "../../../lib/auth-context";

export default function LoginPage() {
  const router = useRouter();
  const { login, error } = useAdminAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <main className="flex min-h-screen items-center justify-center bg-kabisig-bg p-6">
      <div className="grid w-full max-w-6xl overflow-hidden rounded-[40px] border border-slate-200/70 bg-white/95 shadow-soft backdrop-blur lg:grid-cols-[1.15fr,0.85fr] dark:border-white/10 dark:bg-slate-950/65">
        <section className="relative overflow-hidden bg-hero p-10 text-white">
          <div className="absolute -right-12 -top-12 h-48 w-48 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute -left-10 bottom-0 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
          <div className="relative">
            <Image src="/branding/logo-with-tagline.jfif" alt="Kabisig logo" width={360} height={180} className="rounded-[28px] shadow-lg" />
            <h1 className="mt-10 text-4xl font-black">Marketplace command center</h1>
            <p className="mt-4 max-w-lg text-white/85">
              Approve providers, manage bookings and payments, monitor complaints, and track Kabisig marketplace health from one responsive web dashboard.
            </p>
            <div className="mt-10 grid gap-4 md:grid-cols-2">
              <div className="rounded-[28px] bg-white/10 p-6">
                <p className="text-sm uppercase tracking-[0.24em] text-white/70">Web-only admin</p>
                <p className="mt-3 text-lg font-semibold">Optimized for desktop and tablet operations.</p>
              </div>
              <div className="rounded-[28px] bg-white/10 p-6">
                <p className="text-sm uppercase tracking-[0.24em] text-white/70">Operations ready</p>
                <p className="mt-3 text-lg font-semibold">Approvals, bookings, reports, analytics, and payout monitoring.</p>
              </div>
            </div>
          </div>
        </section>
        <section className="bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(231,242,255,0.88))] p-10 lg:px-12 dark:bg-transparent">
          <p className="text-sm font-bold uppercase tracking-[0.24em] text-kabisig-blue">Secure Login</p>
          <h2 className="mt-4 text-3xl font-black text-kabisig-text">Admin access</h2>
          <p className="mt-3 text-sm leading-6 text-kabisig-muted">Use the Kabisig admin dashboard to review providers, monitor live marketplace operations, and manage trust and safety workflows.</p>
          <div className="mt-8 rounded-[28px] bg-white/85 p-6 ring-1 ring-slate-200 dark:bg-slate-50/5 dark:ring-white/10">
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-kabisig-blue shadow-sm">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <p className="font-bold text-kabisig-text">Admin credentials</p>
                <p className="text-sm text-kabisig-muted">Firebase Auth-ready email/password login</p>
              </div>
            </div>
            <div className="space-y-4">
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-kabisig-text">Email</span>
                <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="admin@kabisig.app" className="w-full rounded-2xl border border-white bg-white px-4 py-3 outline-none ring-1 ring-slate-200 transition focus:ring-2 focus:ring-sky-200" />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-kabisig-text">Password</span>
                <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" className="w-full rounded-2xl border border-white bg-white px-4 py-3 outline-none ring-1 ring-slate-200 transition focus:ring-2 focus:ring-sky-200" />
              </label>
              {error ? <p className="text-sm font-semibold text-red-700">{error}</p> : null}
            </div>
            <button
              className="mt-6 w-full rounded-2xl bg-kabisig-blue px-5 py-4 text-sm font-bold text-white shadow-lg shadow-sky-200/70"
              onClick={async () => {
                await login(email, password);
                router.push("/dashboard");
              }}
            >
              Sign in to admin panel
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
