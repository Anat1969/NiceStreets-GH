"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { resizeImage } from "@/lib/image";
import type { PhotoSource } from "@/lib/types";

interface StreetOption {
  id: string;
  name: string;
}

const SOURCES: { value: PhotoSource; label: string; help: string }[] = [
  {
    value: "example",
    label: "דוגמה",
    help: "מתפרסמת מיד לציבור, ומופיעה גם בספריית הדוגמאות.",
  },
  {
    value: "test",
    label: "בדיקה",
    help: "נראית לצוות בלבד, לעולם לא לציבור, ונמחקת עם נתוני ההדגמה.",
  },
];

/**
 * Upload by the admin, without a queue.
 *
 * The source is chosen before the upload and not after, because it decides who
 * will see the photo — and that is not something to discover afterwards.
 */
export default function AdminUpload({ streets }: { streets: StreetOption[] }) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [streetId, setStreetId] = useState("");
  const [source, setSource] = useState<PhotoSource | "">("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [photoName, setPhotoName] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError(null);
    try {
      setPhoto(await resizeImage(file, 1200, 0.82));
      setPhotoName(file.name);
    } catch {
      setError("לא הצלחנו לקרוא את התמונה. נסו קובץ אחר.");
    }
  }

  async function submit() {
    if (!streetId || !source || !photo) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    const response = await fetch("/api/admin/upload", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ streetId, dataUrl: photo, source }),
    });
    setBusy(false);
    if (response.ok) {
      const label = SOURCES.find((s) => s.value === source)?.label ?? "";
      setMessage(`התמונה נשמרה כ${label} ופורסמה.`);
      setPhoto(null);
      setPhotoName("");
      if (fileInput.current) fileInput.current.value = "";
      router.refresh();
      return;
    }
    const data = await response.json().catch(() => ({}));
    setError(data.error ?? "ההעלאה נכשלה.");
  }

  const field =
    "mt-1 w-full rounded-[10px] border border-line bg-surface px-3 py-2 text-[15px] text-ink";

  return (
    <div className="card p-4">
      <div className="grid gap-3">
        <label className="text-[13px] text-ink-soft">
          רחוב
          <select
            value={streetId}
            onChange={(e) => setStreetId(e.target.value)}
            className={field}
          >
            <option value="">בחרו רחוב</option>
            {streets.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>

        <fieldset>
          <legend className="text-[13px] text-ink-soft">סוג התמונה</legend>
          <div className="mt-1 grid gap-2">
            {SOURCES.map((option) => (
              <label
                key={option.value}
                className="flex items-start gap-2 rounded-[10px] border border-line p-2"
              >
                <input
                  type="radio"
                  name="source"
                  value={option.value}
                  checked={source === option.value}
                  onChange={() => setSource(option.value)}
                  className="mt-1 min-h-0"
                />
                <span>
                  <span className="block text-[15px] font-medium text-ink">
                    {option.label}
                  </span>
                  <span className="block text-[13px] text-ink-soft">{option.help}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <label className="text-[13px] text-ink-soft">
          קובץ התמונה
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            onChange={onFile}
            className={field}
          />
        </label>
        {photoName ? (
          <p className="text-[13px] text-ink-soft">נבחר: {photoName}</p>
        ) : null}

        <button
          type="button"
          disabled={busy || !streetId || !source || !photo}
          onClick={submit}
          className="rounded-[12px] bg-accent px-4 py-3 text-[16px] font-medium text-white disabled:opacity-40"
        >
          {busy ? "מעלה…" : "העלאה ופרסום"}
        </button>

        {message ? (
          <p role="status" className="text-[14px] text-accent">
            {message}
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="text-[14px] text-warm">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}
