"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2, X, Check } from "lucide-react";
import { useCategories, type Category } from "@/hooks/useCategories";

const CADENCE_PRESETS = [
  { label: "Every 4 hours", cron: "0 */4 * * *" },
  { label: "Every 6 hours", cron: "15 */6 * * *" },
  { label: "Every 8 hours", cron: "0 */8 * * *" },
  { label: "Every 12 hours", cron: "30 */12 * * *" },
  { label: "Once daily", cron: "0 6 * * *" },
  { label: "Twice daily", cron: "0 6,18 * * *" },
  { label: "3x daily", cron: "0 7,13,19 * * *" },
];

function CadenceSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (cron: string) => void;
}) {
  const isCustom = !CADENCE_PRESETS.some((p) => p.cron === value);
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{label}</label>
      <select
        value={isCustom ? "custom" : value}
        onChange={(e) => {
          if (e.target.value !== "custom") onChange(e.target.value);
        }}
        className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
      >
        {CADENCE_PRESETS.map((p) => (
          <option key={p.cron} value={p.cron}>{p.label}</option>
        ))}
        {isCustom && <option value="custom">Custom ({value})</option>}
      </select>
    </div>
  );
}

export function CategoryManager() {
  const { categories, isLoading, create, update, remove } = useCategories();
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  if (isLoading) {
    return <div className="animate-pulse space-y-3">{Array.from({ length: 3 }, (_, i) => <div key={i} className="h-14 bg-gray-100 dark:bg-gray-800 rounded-lg" />)}</div>;
  }

  async function handleDelete(id: number) {
    const res = await remove(id);
    if (res.ok) {
      setConfirmDeleteId(null);
      setDeleteError(null);
    } else {
      const data = await res.json();
      setDeleteError(data.error ?? "Failed to delete category");
    }
  }

  return (
    <div className="space-y-2">
      {deleteError && (
        <div className="rounded-lg border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950 px-3 py-2 text-sm text-red-800 dark:text-red-300">
          {deleteError} — reassign those sources&apos; category in Content Sources first.
        </div>
      )}

      {categories.map((category) => (
        <div key={category.id}>
          {editingId === category.id ? (
            <EditCategoryForm
              category={category}
              onSave={async (data) => {
                await update(category.id, data);
                setEditingId(null);
              }}
              onCancel={() => setEditingId(null)}
            />
          ) : (
            <div className="flex items-center justify-between rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-3">
              <div className="min-w-0">
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{category.name}</span>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Ingest: {CADENCE_PRESETS.find((p) => p.cron === category.ingestCron)?.label ?? "Custom"} · Curate: {CADENCE_PRESETS.find((p) => p.cron === category.curateCron)?.label ?? "Custom"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setEditingId(category.id); setConfirmDeleteId(null); setDeleteError(null); }}
                  className="rounded p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  title="Edit category"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                {confirmDeleteId === category.id ? (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleDelete(category.id)}
                      className="rounded p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                      title="Confirm delete"
                    >
                      <Check className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => setConfirmDeleteId(null)}
                      className="rounded p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                      title="Cancel"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => { setConfirmDeleteId(category.id); setEditingId(null); }}
                    className="rounded p-1.5 text-gray-400 hover:text-red-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    title="Delete category"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      ))}

      {showAdd ? (
        <AddCategoryForm
          onAdd={async (data) => {
            const res = await create(data);
            if (res.ok) setShowAdd(false);
          }}
          onCancel={() => setShowAdd(false)}
        />
      ) : (
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-700 px-4 py-3 text-sm text-gray-500 hover:border-gray-400 dark:hover:border-gray-600 hover:text-gray-700 dark:hover:text-gray-300 transition-colors w-full"
        >
          <Plus className="h-4 w-4" />
          Add category
        </button>
      )}
    </div>
  );
}

function EditCategoryForm({
  category,
  onSave,
  onCancel,
}: {
  category: Category;
  onSave: (data: { name: string; slug: string; ingestCron: string; curateCron: string }) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(category.name);
  const [slug, setSlug] = useState(category.slug);
  const [ingestCron, setIngestCron] = useState(category.ingestCron);
  const [curateCron, setCurateCron] = useState(category.curateCron);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !slug) return;
    onSave({ name, slug, ingestCron, curateCron });
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-blue-300 dark:border-blue-700 bg-white dark:bg-gray-900 p-4 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Slug</label>
          <input
            type="text"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <CadenceSelect label="Ingest cadence" value={ingestCron} onChange={setIngestCron} />
        <CadenceSelect label="Curate cadence" value={curateCron} onChange={setCurateCron} />
      </div>
      <div className="flex items-center gap-2 pt-1">
        <button type="submit" className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors">
          Save
        </button>
        <button type="button" onClick={onCancel} className="rounded-md px-4 py-2 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors">
          Cancel
        </button>
      </div>
    </form>
  );
}

function AddCategoryForm({
  onAdd,
  onCancel,
}: {
  onAdd: (data: { name: string; slug: string; ingestCron: string; curateCron: string }) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [ingestCron, setIngestCron] = useState(CADENCE_PRESETS[3].cron);
  const [curateCron, setCurateCron] = useState(CADENCE_PRESETS[4].cron);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name) return;
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    onAdd({ name, slug, ingestCron, curateCron });
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 space-y-3">
      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Gaming"
          className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <CadenceSelect label="Ingest cadence" value={ingestCron} onChange={setIngestCron} />
        <CadenceSelect label="Curate cadence" value={curateCron} onChange={setCurateCron} />
      </div>
      <div className="flex items-center gap-2 pt-1">
        <button type="submit" className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors">
          Add Category
        </button>
        <button type="button" onClick={onCancel} className="rounded-md px-4 py-2 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors">
          Cancel
        </button>
      </div>
    </form>
  );
}
