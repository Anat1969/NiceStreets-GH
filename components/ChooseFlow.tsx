"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { resizeImage } from "@/lib/image";

interface StreetOption {
  id: string;
  name: string;
  quarterId: string;
  typology: string;
}

interface Props {
  streets: StreetOption[];
  quarters: { id: string; name: string }[];
  typologies: { key: string; label: string; description: string }[];
  questions: { key: string; label: string; help: string }[];
}

const SCALE_LABELS = ["גרוע", "חלש", "בינוני", "טוב", "מצוין"];

export default function ChooseFlow({ streets, quarters, typologies, questions }: Props) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [query, setQuery] = useState("");
  const [streetId, setStreetId] = useState<string | null>(null);
  const [quarterId, setQuarterId] = useState("");
  const [typology, setTypology] = useState("");
  const [scores, setScores] = useState<Record<string, number>>({});
  const [reason, setReason] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [photoName, setPhotoName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const matches = useMemo(() => {
    const q = query.trim();
    if (!q) return streets.slice(0, 8);
    return streets.filter((s) => s.name.includes(q)).slice(0, 8);
  }, [query, streets]);

  const exactMatch = streets.find((s) => s.name === query.trim());
  const selected = streets.find((s) => s.id === streetId) ?? null;
  const isNewStreet = !selected && query.trim().length > 1;

  function selectStreet(street: StreetOption) {
    setStreetId(street.id);
    setQuery(street.name);
    setQuarterId(street.quarterId);
    setTypology(street.typology);
  }

  const step1Valid = Boolean((selected || isNewStreet) && quarterId && typology);
  const step2Valid = questions.every((q) => scores[q.key] >= 1);

  async function onPhoto(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError(null);
    try {
      const dataUrl = await resizeImage(file, 1200, 0.82);
      setPhoto(dataUrl);
      setPhotoName(file.name);
    } catch {
      setError("לא הצלחנו לקרוא את התמונה. נסו קובץ אחר.");
    }
  }

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/votes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          streetId: selected?.id,
          newStreet: selected
            ? undefined
            : { name: query.trim(), quarterId, typology },
          scores,
          reason,
          photo,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "שמירה נכשלה");
      router.push(`/street/${data.streetId}?saved=1`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "שמירה נכשלה");
      setBusy(false);
    }
  }

  return (
    <div>
      <h1 className="mb-1 text-[24px] font-bold text-ink">לבחור רחוב</h1>
      <p className="mb-4 text-[14px] text-ink-soft">שלושה שלבים, פחות משתי דקות.</p>

      <ol className="mb-5 flex gap-2" aria-label="שלבים">
        {[1, 2, 3].map((n) => (
          <li
            key={n}
            aria-current={step === n ? "step" : undefined}
            className={`flex-1 rounded-full py-1 text-center text-[13px] ${
              step === n
                ? "bg-accent text-white"
                : step > n
                  ? "bg-accent-soft text-accent"
                  : "bg-surface text-ink-faint border border-line"
            }`}
          >
            {n === 1 ? "רחוב" : n === 2 ? "דירוג" : "נימוק"}
          </li>
        ))}
      </ol>

      {error ? (
        <p role="alert" className="mb-4 rounded-[12px] border border-warm bg-warm-soft px-3 py-2 text-[14px] text-ink">
          {error}
        </p>
      ) : null}

      {step === 1 ? (
        <section className="grid gap-4">
          <div>
            <label htmlFor="street" className="mb-1 block text-[15px] font-medium text-ink">
              שם הרחוב
            </label>
            <input
              id="street"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setStreetId(null);
              }}
              placeholder="התחילו להקליד…"
              autoComplete="off"
              className="w-full rounded-[12px] border border-line bg-surface px-3 py-3 text-[16px]"
            />
            {!exactMatch && matches.length > 0 ? (
              <ul className="mt-2 grid gap-1">
                {matches.map((street) => (
                  <li key={street.id}>
                    <button
                      type="button"
                      onClick={() => selectStreet(street)}
                      className="w-full rounded-[10px] border border-line bg-surface px-3 py-2 text-right text-[15px] text-ink"
                    >
                      {street.name}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            {isNewStreet ? (
              <p className="mt-2 text-[13px] text-ink-faint">
                הרחוב אינו ברשימה — הוא יתווסף ויסומן לאימות מול ה־GIS העירוני.
              </p>
            ) : null}
          </div>

          <div>
            <label htmlFor="quarter" className="mb-1 block text-[15px] font-medium text-ink">
              רובע
            </label>
            <select
              id="quarter"
              value={quarterId}
              onChange={(e) => setQuarterId(e.target.value)}
              className="w-full rounded-[12px] border border-line bg-surface px-3 py-3 text-[16px]"
            >
              <option value="">בחרו רובע</option>
              {quarters.map((q) => (
                <option key={q.id} value={q.id}>
                  {q.name}
                </option>
              ))}
            </select>
          </div>

          <fieldset>
            <legend className="mb-2 text-[15px] font-medium text-ink">סוג הרחוב</legend>
            <div className="grid gap-2">
              {typologies.map((t) => (
                <label
                  key={t.key}
                  className={`card flex cursor-pointer items-start gap-3 p-3 ${
                    typology === t.key ? "border-accent bg-accent-soft" : ""
                  }`}
                >
                  <input
                    type="radio"
                    name="typology"
                    value={t.key}
                    checked={typology === t.key}
                    onChange={() => setTypology(t.key)}
                    className="mt-1"
                  />
                  <span>
                    <span className="block text-[15px] font-medium text-ink">{t.label}</span>
                    <span className="block text-[13px] text-ink-soft">{t.description}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <button
            type="button"
            disabled={!step1Valid}
            onClick={() => setStep(2)}
            className="rounded-[14px] bg-accent px-5 py-3 text-[16px] font-medium text-white disabled:opacity-40"
          >
            לשאלות
          </button>
        </section>
      ) : null}

      {step === 2 ? (
        <section className="grid gap-4">
          {questions.map((question) => (
            <fieldset key={question.key} className="card p-3">
              <legend className="px-1 text-[16px] font-medium text-ink">{question.label}</legend>
              <p className="mb-2 text-[13px] text-ink-soft">{question.help}</p>
              <div className="flex gap-1" role="group" aria-label={question.label}>
                {[1, 2, 3, 4, 5].map((value) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={scores[question.key] === value}
                    aria-label={`${question.label}: ${value} — ${SCALE_LABELS[value - 1]}`}
                    onClick={() => setScores((s) => ({ ...s, [question.key]: value }))}
                    className={`min-h-11 flex-1 rounded-[10px] border text-[15px] tabular-nums ${
                      scores[question.key] === value
                        ? "border-accent bg-accent text-white"
                        : "border-line bg-surface text-ink"
                    }`}
                  >
                    {value}
                  </button>
                ))}
              </div>
              <p className="mt-1 text-[12px] text-ink-faint">
                1 = {SCALE_LABELS[0]} · 5 = {SCALE_LABELS[4]}
              </p>
            </fieldset>
          ))}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="flex-1 rounded-[14px] border border-line bg-surface px-5 py-3 text-[16px]"
            >
              חזרה
            </button>
            <button
              type="button"
              disabled={!step2Valid}
              onClick={() => setStep(3)}
              className="flex-1 rounded-[14px] bg-accent px-5 py-3 text-[16px] font-medium text-white disabled:opacity-40"
            >
              לנימוק
            </button>
          </div>
        </section>
      ) : null}

      {step === 3 ? (
        <section className="grid gap-4">
          <div>
            <label htmlFor="reason" className="mb-1 block text-[15px] font-medium text-ink">
              למה דווקא הרחוב הזה?
            </label>
            <textarea
              id="reason"
              value={reason}
              maxLength={600}
              rows={5}
              onChange={(e) => setReason(e.target.value)}
              placeholder="משפט או שניים במילים שלכם."
              className="w-full rounded-[12px] border border-line bg-surface px-3 py-3 text-[16px]"
            />
            <p className="mt-1 text-[12px] text-ink-faint">{reason.length} מתוך 600</p>
          </div>

          <div>
            <p className="mb-1 text-[15px] font-medium text-ink">תמונה אחת (לא חובה)</p>
            <input
              ref={fileInput}
              id="photo"
              type="file"
              accept="image/*"
              onChange={onPhoto}
              className="w-full rounded-[12px] border border-line bg-surface px-3 py-2 text-[15px]"
            />
            <p className="mt-1 text-[13px] text-ink-soft">
              התמונה מוקטנת במכשיר לפני השליחה, נתוני ה־EXIF נמחקים, והיא מתפרסמת רק אחרי
              אישור הצוות. אנא הימנעו מצילום פנים ולוחיות רישוי.
            </p>
            {photo ? (
              <div className="mt-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo} alt={`תצוגה מקדימה: ${photoName}`} className="max-h-48 rounded-[12px]" />
                <button
                  type="button"
                  onClick={() => {
                    setPhoto(null);
                    setPhotoName("");
                    if (fileInput.current) fileInput.current.value = "";
                  }}
                  className="mt-2 text-[14px] text-ink-soft underline"
                >
                  הסרת התמונה
                </button>
              </div>
            ) : null}
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="flex-1 rounded-[14px] border border-line bg-surface px-5 py-3 text-[16px]"
            >
              חזרה
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={submit}
              className="flex-1 rounded-[14px] bg-accent px-5 py-3 text-[16px] font-medium text-white disabled:opacity-40"
            >
              {busy ? "שולח…" : "שליחת הקול"}
            </button>
          </div>
          <p className="text-[13px] text-ink-faint">
            קול אחד לכל רחוב. שליחה חוזרת מעדכנת את הקול הקודם שלכם.
          </p>
        </section>
      ) : null}
    </div>
  );
}
