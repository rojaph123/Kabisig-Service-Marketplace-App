"use client";

import { useEffect, useState } from "react";
import { categoryService, coverageAreaService, type CoverageArea } from "@kabisig/shared";
import { Card, DataTable, EmptyPanel, Topbar } from "../../../components/ui";
import { loadMarketplaceSnapshot, type MarketplaceSnapshot } from "../../../lib/marketplace-data";

const iconOptions = [
  "flash-outline",
  "water-outline",
  "flame-outline",
  "hammer-outline",
  "home-outline",
  "construct-outline",
  "build-outline",
  "color-palette-outline",
  "car-sport-outline",
  "bicycle-outline"
];

const categorySuggestions: Record<string, { icon: string; iconColor: string; description: string; startingPrice: string }> = {
  painter: {
    icon: "color-palette-outline",
    iconColor: "#7C3AED",
    description: "Interior and exterior painting, repainting, and finishing services.",
    startingPrice: "650"
  },
  "car mechanic": {
    icon: "car-sport-outline",
    iconColor: "#DC2626",
    description: "Car diagnostics, repair, tune-ups, and maintenance services.",
    startingPrice: "900"
  },
  "motor mechanic": {
    icon: "bicycle-outline",
    iconColor: "#0F766E",
    description: "Motorcycle repair, tune-ups, diagnostics, and maintenance services.",
    startingPrice: "700"
  }
};

function toCategoryId(name: string) {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export default function CategoriesPage() {
  const [snapshot, setSnapshot] = useState<MarketplaceSnapshot | null>(null);
  const [coverageAreas, setCoverageAreas] = useState<CoverageArea[]>([]);
  const [form, setForm] = useState({ name: "", icon: "construct-outline", iconColor: "#2563EB", description: "", startingPrice: "0" });
  const [coverageForm, setCoverageForm] = useState({ name: "" });
  const [saving, setSaving] = useState(false);
  const [savingCoverage, setSavingCoverage] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingCoverageId, setEditingCoverageId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deletingCoverageId, setDeletingCoverageId] = useState<string | null>(null);

  async function reload() {
    const [nextSnapshot, nextCoverageAreas] = await Promise.all([
      loadMarketplaceSnapshot(),
      coverageAreaService.getAllCoverageAreas()
    ]);
    setSnapshot(nextSnapshot);
    setCoverageAreas(nextCoverageAreas);
  }

  useEffect(() => {
    void reload();
  }, []);

  async function handleCreateCategory() {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const generatedId = editingId || toCategoryId(form.name);
      const payload = {
        id: generatedId,
        name: form.name.trim(),
        icon: form.icon.trim() || "construct-outline",
        iconColor: form.iconColor,
        description: form.description.trim(),
        startingPrice: Number(form.startingPrice) || 0
      };

      if (editingId) {
        await categoryService.updateCategory(editingId, payload);
      } else {
        await categoryService.createCategory(payload);
      }

      setForm({ name: "", icon: "construct-outline", iconColor: "#2563EB", description: "", startingPrice: "0" });
      setEditingId(null);
      await reload();
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteCategory(categoryId: string) {
    setDeletingId(categoryId);
    try {
      await categoryService.deleteCategory(categoryId);
      if (editingId === categoryId) {
        setEditingId(null);
        setForm({ name: "", icon: "construct-outline", iconColor: "#2563EB", description: "", startingPrice: "0" });
      }
      await reload();
    } finally {
      setDeletingId(null);
    }
  }

  async function handleSaveCoverageArea() {
    if (!coverageForm.name.trim()) return;
    setSavingCoverage(true);
    try {
      const generatedId = editingCoverageId || toCategoryId(coverageForm.name);
      const payload = {
        id: generatedId,
        name: coverageForm.name.trim(),
        active: true
      };

      if (editingCoverageId) {
        await coverageAreaService.updateCoverageArea(editingCoverageId, payload);
      } else {
        await coverageAreaService.createCoverageArea(payload);
      }

      setCoverageForm({ name: "" });
      setEditingCoverageId(null);
      await reload();
    } finally {
      setSavingCoverage(false);
    }
  }

  async function handleDeleteCoverageArea(coverageAreaId: string) {
    setDeletingCoverageId(coverageAreaId);
    try {
      await coverageAreaService.deleteCoverageArea(coverageAreaId);
      if (editingCoverageId === coverageAreaId) {
        setEditingCoverageId(null);
        setCoverageForm({ name: "" });
      }
      await reload();
    } finally {
      setDeletingCoverageId(null);
    }
  }

  return (
    <>
      <Topbar title="Service categories" />
      <Card title="Category management">
        <div className="mb-5 grid gap-3 rounded-[26px] bg-slate-50 p-4 md:grid-cols-5 dark:bg-white/5">
          <input value={form.name ?? ""} onChange={(event) => {
            const nextName = event.target.value;
            const suggestion = categorySuggestions[nextName.trim().toLowerCase()];
            setForm((current) => ({
              ...current,
              name: nextName,
              icon: suggestion?.icon || current.icon,
              iconColor: suggestion?.iconColor || current.iconColor,
              description: suggestion?.description || current.description,
              startingPrice: suggestion?.startingPrice || current.startingPrice
            }));
          }} placeholder="Category name" className="rounded-2xl border border-kabisig-border bg-white px-4 py-3 text-sm text-kabisig-text outline-none dark:bg-slate-950/70" />
          <select value={form.icon ?? "construct-outline"} onChange={(event) => setForm((current) => ({ ...current, icon: event.target.value }))} className="rounded-2xl border border-kabisig-border bg-white px-4 py-3 text-sm text-kabisig-text outline-none dark:bg-slate-950/70">
            {iconOptions.map((icon) => (
              <option key={icon} value={icon}>{icon}</option>
            ))}
          </select>
          <input value={form.startingPrice ?? "0"} onChange={(event) => setForm((current) => ({ ...current, startingPrice: event.target.value }))} placeholder="Starting price" className="rounded-2xl border border-kabisig-border bg-white px-4 py-3 text-sm text-kabisig-text outline-none dark:bg-slate-950/70" />
          <button className="rounded-2xl bg-kabisig-blue px-4 py-3 text-sm font-bold text-white disabled:opacity-60" disabled={saving} onClick={() => void handleCreateCategory()}>
            {saving ? "Saving..." : editingId ? "Update category" : "Add category"}
          </button>
          <div className="md:col-span-5 rounded-2xl border border-dashed border-kabisig-border px-4 py-3 text-sm text-kabisig-text-muted">
            Category ID will be generated automatically: <span className="font-bold text-kabisig-text">{toCategoryId(form.name || "new-category")}</span>
          </div>
          <input type="color" value={form.iconColor ?? "#2563EB"} onChange={(event) => setForm((current) => ({ ...current, iconColor: event.target.value }))} className="h-12 w-20 rounded-2xl border border-kabisig-border bg-white px-2 py-2 dark:bg-slate-950/70" />
          <textarea value={form.description ?? ""} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} placeholder="Description" className="md:col-span-5 rounded-2xl border border-kabisig-border bg-white px-4 py-3 text-sm text-kabisig-text outline-none dark:bg-slate-950/70" />
          {editingId ? (
            <button
              className="md:col-span-5 rounded-2xl border border-kabisig-border px-4 py-3 text-sm font-bold text-kabisig-text"
              onClick={() => {
                setEditingId(null);
                setForm({ name: "", icon: "construct-outline", iconColor: "#2563EB", description: "", startingPrice: "0" });
              }}
            >
              Cancel edit
            </button>
          ) : null}
        </div>
        {snapshot?.categories.length ? (
          <DataTable
            columns={["Category", "Description", "Starting Price", "Icon", "Color", "Actions"]}
            rows={snapshot.categories.map((category) => [
              category.name,
              category.description,
              `PHP ${category.startingPrice.toLocaleString()}`,
              category.icon,
              <div key={`${category.id}-color`} className="h-6 w-6 rounded-full ring-1 ring-slate-300" style={{ backgroundColor: category.iconColor || "#2563EB" }} />,
              <div key={`${category.id}-actions`} className="flex gap-2">
                <button
                  className="rounded-xl border border-kabisig-border px-3 py-2 text-xs font-bold text-kabisig-text"
                  onClick={() => {
                    setEditingId(category.id);
                    setForm({
                      name: category.name ?? "",
                      icon: category.icon ?? "construct-outline",
                      iconColor: category.iconColor || "#2563EB",
                      description: category.description ?? "",
                      startingPrice: String(category.startingPrice ?? 0)
                    });
                  }}
                >
                  Edit
                </button>
                <button
                  className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300"
                  disabled={deletingId === category.id}
                  onClick={() => void handleDeleteCategory(category.id)}
                >
                  {deletingId === category.id ? "Deleting..." : "Delete"}
                </button>
              </div>,
            ])}
          />
        ) : (
          <EmptyPanel title="No categories yet" description="Create your marketplace service categories in Firestore to make them available in the mobile app." />
        )}
      </Card>
      <Card title="Coverage areas">
        <div className="mb-5 grid gap-3 rounded-[26px] bg-slate-50 p-4 md:grid-cols-4 dark:bg-white/5">
          <input
            value={coverageForm.name ?? ""}
            onChange={(event) => setCoverageForm({ name: event.target.value })}
            placeholder="Coverage area name"
            className="rounded-2xl border border-kabisig-border bg-white px-4 py-3 text-sm text-kabisig-text outline-none dark:bg-slate-950/70"
          />
          <button className="rounded-2xl bg-kabisig-blue px-4 py-3 text-sm font-bold text-white disabled:opacity-60" disabled={savingCoverage} onClick={() => void handleSaveCoverageArea()}>
            {savingCoverage ? "Saving..." : editingCoverageId ? "Update area" : "Add area"}
          </button>
          <div className="md:col-span-2 rounded-2xl border border-dashed border-kabisig-border px-4 py-3 text-sm text-kabisig-text-muted">
            Coverage area ID: <span className="font-bold text-kabisig-text">{toCategoryId(coverageForm.name || "new-coverage-area")}</span>
          </div>
          {editingCoverageId ? (
            <button
              className="md:col-span-4 rounded-2xl border border-kabisig-border px-4 py-3 text-sm font-bold text-kabisig-text"
              onClick={() => {
                setEditingCoverageId(null);
                setCoverageForm({ name: "" });
              }}
            >
              Cancel edit
            </button>
          ) : null}
        </div>
        {coverageAreas.length ? (
          <DataTable
            columns={["Coverage Area", "Actions"]}
            rows={coverageAreas.map((coverageArea) => [
              coverageArea.name,
              <div key={`${coverageArea.id}-actions`} className="flex gap-2">
                <button
                  className="rounded-xl border border-kabisig-border px-3 py-2 text-xs font-bold text-kabisig-text"
                  onClick={() => {
                    setEditingCoverageId(coverageArea.id);
                    setCoverageForm({ name: coverageArea.name ?? "" });
                  }}
                >
                  Edit
                </button>
                <button
                  className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300"
                  disabled={deletingCoverageId === coverageArea.id}
                  onClick={() => void handleDeleteCoverageArea(coverageArea.id)}
                >
                  {deletingCoverageId === coverageArea.id ? "Deleting..." : "Delete"}
                </button>
              </div>,
            ])}
          />
        ) : (
          <EmptyPanel title="No coverage areas yet" description="Add city or coverage options here so providers can select them during onboarding." />
        )}
      </Card>
    </>
  );
}
