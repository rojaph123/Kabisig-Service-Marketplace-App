"use client";

import clsx from "clsx";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  BadgeCheck,
  BarChart3,
  BellRing,
  CalendarCheck2,
  CreditCard,
  LayoutDashboard,
  LifeBuoy,
  ListFilter,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Moon,
  Sun,
  TrendingUp,
  Users,
  Wrench
} from "lucide-react";
import type { ChangeEventHandler, ReactNode, SelectHTMLAttributes } from "react";
import { useEffect, useState } from "react";
import { useAdminTheme } from "../lib/theme-context";
import { loadMarketplaceSnapshot } from "../lib/marketplace-data";

export function BrandHeader() {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/80 shadow-sm ring-1 ring-white/60">
        <Image src="/branding/logo.jfif" alt="Kabisig" width={38} height={38} className="rounded-full" />
      </div>
      <div>
        <p className="text-lg font-black text-kabisig-text">Kabisig</p>
        <p className="text-sm text-kabisig-muted">Marketplace Operations</p>
      </div>
    </div>
  );
}

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/provider-approvals", label: "Provider Approvals", icon: ShieldCheck },
  { href: "/bookings", label: "Bookings", icon: CalendarCheck2 },
  { href: "/users", label: "Users", icon: Users },
  { href: "/payments", label: "Payments", icon: CreditCard },
  { href: "/reports", label: "Reports", icon: LifeBuoy },
  { href: "/categories", label: "Categories", icon: Wrench },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/settings", label: "Profile / Settings", icon: Settings }
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="sticky top-6 hidden h-[calc(100vh-3rem)] w-80 shrink-0 self-start overflow-y-auto rounded-[32px] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.94),rgba(224,237,255,0.92))] p-6 shadow-soft backdrop-blur xl:block dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(12,25,49,0.92),rgba(15,31,58,0.92))]">
      <BrandHeader />
      <div className="mt-6 rounded-[24px] bg-hero p-5 text-white shadow-lg shadow-blue-900/20">
        <p className="text-xs font-bold uppercase tracking-[0.28em] text-white/70">Kabisig Pulse</p>
        <p className="mt-3 text-2xl font-black">Operationally ready</p>
        <p className="mt-2 text-sm text-white/85">Approval queues, marketplace metrics, and exception monitoring in one place.</p>
      </div>
      <nav className="mt-8 space-y-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                "group flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition",
                active
                  ? "bg-kabisig-blue text-white shadow-lg shadow-sky-300/60"
                  : "text-slate-700 hover:bg-white/60 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/6 dark:hover:text-white"
              )}
            >
              <span className={clsx("flex h-9 w-9 items-center justify-center rounded-xl", active ? "bg-white/14" : "bg-white/80 dark:bg-white/8")}>
                <Icon className="h-4 w-4" />
              </span>
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

export function Topbar({ title, action }: { title: string; action?: ReactNode }) {
  const { theme, toggleTheme } = useAdminTheme();
  const [liveQueue, setLiveQueue] = useState("Loading live queue...");

  useEffect(() => {
    async function loadQueue() {
      try {
        const snapshot = await loadMarketplaceSnapshot();
        setLiveQueue(`${snapshot.analytics.pendingApprovals} approvals • ${snapshot.analytics.activeBookings} active bookings • ${snapshot.analytics.totalComplaints} complaints`);
      } catch {
        setLiveQueue("Live queue unavailable");
      }
    }

    void loadQueue();
    const interval = setInterval(() => {
      void loadQueue();
    }, 15000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative overflow-hidden rounded-[32px] border border-white/10 bg-hero p-7 text-white shadow-soft">
      <div className="absolute right-0 top-0 h-48 w-48 rounded-full bg-white/10 blur-3xl" />
      <div className="absolute bottom-0 left-0 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
      <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm uppercase tracking-[0.24em] text-white/70">
            <Sparkles className="h-4 w-4" />
            Kabisig Admin
          </div>
          <h1 className="mt-3 text-3xl font-black lg:text-4xl">{title}</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/85">
            Monitor marketplace activity, approve providers, track operational issues, and keep the Kabisig service network healthy and responsive.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3 rounded-2xl border border-white/15 bg-white/10 px-4 py-3">
            <BellRing className="h-4 w-4" />
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-white/65">Live Queue</p>
              <p className="text-sm font-bold">{liveQueue}</p>
            </div>
          </div>
          <button
            className="flex items-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm font-bold text-white"
            onClick={toggleTheme}
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            {theme === "dark" ? "Light mode" : "Dark mode"}
          </button>
          {action}
        </div>
      </div>
    </div>
  );
}

export function DashboardStatCard({
  title,
  value,
  hint,
  trend
}: {
  title: string;
  value: string;
  hint: string;
  trend?: string;
}) {
  return (
    <div className="rounded-[28px] border border-slate-200/80 bg-white/92 p-5 shadow-soft backdrop-blur dark:border-white/10 dark:bg-slate-900/75">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-kabisig-muted">{title}</p>
          <p className="mt-3 text-3xl font-black text-kabisig-text">{value}</p>
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-kabisig-blue dark:bg-white/8">
          <TrendingUp className="h-5 w-5" />
        </div>
      </div>
      <p className="mt-3 text-sm text-kabisig-muted">{hint}</p>
      {trend ? <p className="mt-2 text-xs font-bold uppercase tracking-[0.18em] text-kabisig-blue">{trend}</p> : null}
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const color =
    status === "Completed" || status === "Paid" || status === "Resolved"
      ? "bg-emerald-100 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-400/20"
      : status === "Accepted" || status === "Approved"
        ? "bg-blue-100 text-blue-700 ring-blue-200 dark:bg-blue-500/15 dark:text-blue-300 dark:ring-blue-400/20"
        : status === "On the Way"
          ? "bg-cyan-100 text-cyan-700 ring-cyan-200 dark:bg-cyan-500/15 dark:text-cyan-300 dark:ring-cyan-400/20"
          : status === "In Progress" || status === "Revision Requested"
            ? "bg-indigo-100 text-indigo-700 ring-indigo-200 dark:bg-indigo-500/15 dark:text-indigo-300 dark:ring-indigo-400/20"
            : status === "Pending Approval" || status === "Pending" || status === "Under Review"
              ? "bg-amber-100 text-amber-700 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-400/20"
              : status === "Rejected" || status === "Cancelled" || status === "Failed"
                ? "bg-rose-100 text-rose-700 ring-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:ring-rose-400/20"
                : "bg-sky-100 text-sky-700 ring-sky-200 dark:bg-sky-500/15 dark:text-sky-300 dark:ring-sky-400/20";

  return <span className={clsx("rounded-full px-3 py-1 text-xs font-bold ring-1", color)}>{status}</span>;
}

export function SearchInput({
  placeholder = "Search...",
  value,
  onChange
}: {
  placeholder?: string;
  value?: string;
  onChange?: ChangeEventHandler<HTMLInputElement>;
}) {
  return (
    <div className="flex min-w-[240px] items-center gap-3 rounded-2xl border border-slate-200/80 bg-white/90 px-4 py-3 shadow-sm dark:border-white/10 dark:bg-slate-900/70">
      <Search className="h-4 w-4 text-kabisig-muted" />
      <input value={value} onChange={onChange} className="w-full bg-transparent text-sm text-kabisig-text outline-none placeholder:text-slate-400" placeholder={placeholder} />
    </div>
  );
}

export function FilterBar({ children }: { children?: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 rounded-[28px] border border-slate-200/80 bg-white/88 p-4 shadow-soft backdrop-blur lg:flex-row lg:items-center lg:justify-between dark:border-white/10 dark:bg-slate-900/70">
      <div className="flex items-center gap-2 text-sm font-bold text-kabisig-muted">
        <ListFilter className="h-4 w-4" />
        Filters
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:flex lg:items-center">{children}</div>
    </div>
  );
}

export function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value?: string;
  onChange?: SelectHTMLAttributes<HTMLSelectElement>["onChange"];
  options?: Array<{ label: string; value: string }>;
}) {
  return (
    <select value={value} onChange={onChange} className="rounded-2xl border border-slate-200/80 bg-white/92 px-4 py-3 text-sm font-medium text-kabisig-text shadow-sm dark:border-white/10 dark:bg-slate-950/70">
      {options?.length
        ? options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))
        : <option>{label}</option>}
    </select>
  );
}

export function Card({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="rounded-[32px] border border-slate-200/80 bg-white/92 p-6 shadow-soft backdrop-blur dark:border-white/10 dark:bg-slate-900/72">
      <div className="mb-5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-8 w-1.5 rounded-full bg-kabisig-orange" />
          <h2 className="text-xl font-black text-kabisig-text">{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function DataTable({
  columns,
  rows
}: {
  columns: string[];
  rows: ReactNode[][];
}) {
  return (
    <div className="overflow-hidden rounded-[26px] border border-kabisig-border bg-white/88 dark:bg-slate-950/60">
      <table className="min-w-full divide-y divide-kabisig-border text-left">
        <thead className="bg-slate-50 dark:bg-white/5">
          <tr>
            {columns.map((column) => (
              <th key={column} className="px-5 py-4 text-xs font-black uppercase tracking-[0.16em] text-kabisig-muted">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-kabisig-border bg-transparent">
          {rows.map((row, index) => (
            <tr key={index} className="transition hover:bg-blue-50/70 dark:hover:bg-white/5">
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className="px-5 py-4 text-sm text-kabisig-text">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function EmptyPanel({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-[28px] bg-slate-50 p-8 text-center dark:bg-white/5">
      <BadgeCheck className="mx-auto h-10 w-10 text-kabisig-blue" />
      <p className="mt-4 text-lg font-black text-kabisig-text">{title}</p>
      <p className="mt-2 text-sm leading-6 text-kabisig-muted">{description}</p>
    </div>
  );
}

export function KpiRibbon() {
  return (
    <div className="grid gap-4 rounded-[28px] border border-slate-200/80 bg-white/92 p-5 shadow-soft md:grid-cols-3 dark:border-white/10 dark:bg-slate-900/72">
      <RibbonItem icon={Activity} label="Operational health" value="Stable" note="Queues within SLA targets" />
      <RibbonItem icon={ShieldCheck} label="Provider trust" value="94%" note="Verified document review rate" />
      <RibbonItem icon={Users} label="Marketplace activity" value="High" note="Demand remains healthy this week" />
    </div>
  );
}

function RibbonItem({
  icon: Icon,
  label,
  value,
  note
}: {
  icon: typeof Activity;
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div className="rounded-[24px] bg-slate-50 p-4 dark:bg-white/5">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-kabisig-blue shadow-sm dark:bg-white/8">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm font-bold text-kabisig-text">{label}</p>
          <p className="text-xs text-kabisig-muted">{note}</p>
        </div>
      </div>
      <p className="mt-4 text-2xl font-black text-kabisig-text">{value}</p>
    </div>
  );
}
