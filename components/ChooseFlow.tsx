"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { resizeImage } from "@/lib/image";
import { normalizeStreetName } from "@/lib/street-name";
import ScaleInput, { SCALE_STEPS } from "@/components/ScaleInput";

interface StreetOption {
  code: string;
  name: string;
  synonyms: string[];
  /** Assigned by staff; null means the street is not classified yet. */
  typology: string | null;
}

interface Props {
  streets: StreetOption[];
  typologies: { key: string; label: string; description: string }[];
  typologyLabels: Record<string, string>;
  questions: { key: string; label: string; help: string }[];
  registrySource: string;
}

export default function ChooseFlow({
  streets,
  typologies,
  typologyLabels,
  questions,
  registrySource,
}: Props) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<StreetOption | null>(null);
  const [suggestType, setSuggestType] = useState(false);
  const [typologySuggestion, setTypologySuggestion] = useState("");
  const [scores, setScores] = useState<Record<string, number>>({});
  const [reason, setReason] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [photoName, setPhotoName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  /** Matches the official name and the registry's other spellings. */
  const matches = useMemo(() => {
    const needle = normalizeStreetName(query);
    if (!needle) return [];
    const starts: StreetOption[] = [];
    const contains: StreetOption[] = [];
    const viaSynonym: { street: StreetOption; synonym: string }[] = [];

    for (const street of streets) {
      const name = normalizeStreetName(street.name);
      if (name.startsWith(needle)) starts.push(street);
      else if (name.includes(needle)) contains.push(street);
      else {
        const synonym = street.synonyms.find((s) =>
          normalizeStreetName(s).includes(needle),
        );
        if (synonym) viaSynonym.push({ street, synonym });
      }
      if (starts.length >= 8) break;
    }

    return [
      ...starts.map((street) => ({ street, synonym: null as string | null })),
      ...contains.map((street) => ({ street, synonym: null as string | null })),
      ...viaSynonym,
    ].slice(0, 8);
  }, [query, streets]);

  const step1Valid = selected !== null;
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
    if (!selected) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/votes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          streetCode: selected.code,
          scores,
          reason,
          typologySuggestion: suggestType && typologySuggestion ? typologySuggestion : null,
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
        <p
          role="alert"
          className="mb-4 rounded-[12px] border border-warm bg-warm-soft px-3 py-2 text-[14px] text-ink"
        >
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
                setSelected(null);
              }}
              placeholder="התחילו להקליד…"
              autoComplete="off"
              role="combobox"
              aria-expanded={matches.length > 0 && !selected}
              aria-controls="street-matches"
              className="w-full rounded-[12px] border border-line bg-surface px-3 py-3 text-[16px]"
            />

            {selected ? (
              <p className="mt-2 text-[14px] text-accent">
                נבחר: {selected.name}
              </p>
            ) : matches.length > 0 ? (
              <ul id="street-matches" className="mt-2 grid gap-1">
                {matches.map(({ street, synonym }) => (
                  <li key={street.code}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelected(street);
                        setQuery(street.name);
                      }}
                      className="w-full rounded-[10px] border border-line bg-surface px-3 py-2 text-right text-[15px] text-ink"
                    >
                      {street.name}
                      {synonym ? (
                        <span className="block text-[12px] text-ink-faint">
                          ידוע גם כ־{synonym}
                        </span>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
            ) : query.trim().length > 0 ? (
              <p className="mt-2 text-[13px] text-ink-soft">
                לא נמצא רחוב בשם הזה ברשימת הרחובות הרשמית של אשדוד. בדקו את
                האיות, או נסו חלק מהשם.
              </p>
            ) : null}

            <p className="mt-2 text-[12px] text-ink-faint">
              הרשימה מבוססת על {registrySource}, וכוללת גם שמות מקובלים שאינם השם
              הרשמי.
            </p>
          </div>

          {selected ? (
            <div className="card p-3">
              <p className="text-[15px] font-medium text-ink">סוג הרחוב</p>
              <p className="text-[14px] text-ink-soft">
                {selected.typology
                  ? typologyLabels[selected.typology]
                  : "טרם סווג על ידי צוות אדריכלות העיר"}
              </p>
              <p className="mt-1 text-[12px] text-ink-faint">
                סוג הרחוב נקבע על ידי הצוות, כדי שההשוואה תהיה בין רחובות מאותו סוג.
              </p>

              <label className="mt-3 flex items-center gap-2 text-[14px] text-ink">
                <input
                  type="checkbox"
                  checked={suggestType}
                  onChange={(e) => setSuggestType(e.target.checked)}
                />
                לדעתי זה רחוב מסוג אחר
              </label>
              {suggestType ? (
                <select
                  value={typologySuggestion}
                  onChange={(e) => setTypologySuggestion(e.target.value)}
                  aria-label="הסוג שלדעתכם מתאים"
                  className="mt-2 w-full rounded-[10px] border border-line bg-surface px-3 py-2 text-[15px]"
                >
                  <option value="">בחרו סוג</option>
                  {typologies.map((t) => (
                    <option key={t.key} value={t.key}>
                      {t.label}
                    </option>
                  ))}
                </select>
              ) : null}
            </div>
          ) : null}

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
              <div className="flex items-start gap-3">
                {/* Decorative: the question text carries the meaning. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/criteria/${question.key}.svg`}
                  alt=""
                  width={44}
                  height={44}
                  className="mt-[2px] h-11 w-11 shrink-0 rounded-[10px]"
                />
                <div className="min-w-0 flex-1">
                  <legend className="px-0 text-[16px] font-medium text-ink">
                    {question.label}
                  </legend>
                  <p className="mb-2 text-[13px] text-ink-soft">{question.help}</p>
                  <ScaleInput
                    name={question.label}
                    value={scores[question.key]}
                    onChange={(value) =>
                      setScores((s) => ({ ...s, [question.key]: value }))
                    }
                  />
                </div>
              </div>
            </fieldset>
          ))}

          <p className="text-[12px] text-ink-faint">
            הסולם: {SCALE_STEPS.map((s) => `${s.value} ${s.label}`).join(" · ")}
          </p>

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
              התמונה מוקטנת במכשיר לפני השליחה, נתוני ה־EXIF נמחקים, והיא מתפרסמת רק
              אחרי אישור הצוות. אנא הימנעו מצילום פנים ולוחיות רישוי.
            </p>
            {photo ? (
              <div className="mt-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo}
                  alt={`תצוגה מקדימה: ${photoName}`}
                  className="max-h-48 rounded-[12px]"
                />
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
