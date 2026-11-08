"use client";

import { ensureResidentSession } from "@/lib/supabase/browser";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { imageSlot, imageSlotUrl } from "@/lib/content-images";
import { normalizeStreetName } from "@/lib/street-name";
import ScaleInput, { SCALE_STEPS } from "@/components/ScaleInput";
import PhotoDrop from "@/components/PhotoDrop";
import VoiceText from "@/components/VoiceText";
import { pendingPhotoKey } from "@/components/MyPendingPhoto";

interface StreetOption {
  code: string;
  name: string;
  synonyms: string[];
  /** True when the street runs through several quarters (a main boulevard). */
  crossing: boolean;
  /** סוג הרחוב: של הצוות, ובלעדיו ההערכה משכבת הרחובות העירונית. */
  typology: string | null;
  typologySource: "staff" | "gis" | null;
  center: [number, number] | null;
}

interface Props {
  streets: StreetOption[];
  typologies: { key: string; label: string; description: string }[];
  typologyLabels: Record<string, string>;
  questions: {
    key: string;
    label: string;
    help: string;
    criteria: { key: string; name: string; text: string }[];
    hasImage: boolean;
  }[];
  registrySource: string;
  segmentQuarters: { id: string; name: string }[];
  initialStreet?: StreetOption | null;
  initialQuarterId?: string;
}

/*
 * שלושה שלבים, וכל מסך עושה דבר אחד (ענת, 08.11.2026):
 * בראש כל שלב — מה עושים כאן, בצעדים ממוספרים. בתחתית — מה השלב הבא.
 * כוכבית על כל מה שחובה. הקלט (מה שהתושב ממלא) בשדות לבנים; הפלט (מה
 * שנבחר ומה ייצא ממנו) בלוח צבוע עם התווית "התוצאה".
 */
const STEPS = [
  { n: 1, title: "רחוב" },
  { n: 2, title: "7 שאלות" },
  { n: 3, title: "מילים ותמונה" },
];

export default function ChooseFlow({
  streets,
  typologies,
  typologyLabels,
  questions,
  registrySource,
  segmentQuarters,
  initialStreet = null,
  initialQuarterId = "",
}: Props) {
  const router = useRouter();
  const [step, setStep] = useState(
    initialStreet && (!initialStreet.crossing || initialQuarterId) ? 2 : 1,
  );
  const [query, setQuery] = useState(initialStreet?.name ?? "");
  const [selected, setSelected] = useState<StreetOption | null>(initialStreet);
  const [quarterId, setQuarterId] = useState(initialQuarterId);
  const [typologySuggestion, setTypologySuggestion] = useState("");
  const [scores, setScores] = useState<Record<string, number>>({});
  const [reason, setReason] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
        const synonym = street.synonyms.find((s) => normalizeStreetName(s).includes(needle));
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

  const needsQuarter = selected?.crossing ?? false;
  const step1Valid = selected !== null && (!needsQuarter || quarterId.length > 0);
  const answered = questions.filter((q) => scores[q.key] >= 1).length;
  const step2Valid = answered === questions.length;
  const quarterName = segmentQuarters.find((q) => q.id === quarterId)?.name ?? "";

  function go(n: number) {
    setStep(n);
    setError(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function submit() {
    if (!selected) return;
    setBusy(true);
    setError(null);
    try {
      await ensureResidentSession();
      const response = await fetch("/api/votes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          streetCode: selected.code,
          quarterId: selected.crossing ? quarterId : null,
          scores,
          reason,
          typologySuggestion: typologySuggestion || null,
          photo,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "שמירה נכשלה");
      if (photo) {
        try {
          sessionStorage.setItem(
            pendingPhotoKey(data.streetId),
            JSON.stringify({ dataUrl: photo, reason }),
          );
        } catch {
          /* אחסון מלא או חסום — התמונה נשמרה בשרת בכל מקרה. */
        }
      }
      router.push(`/street/${data.streetId}?saved=1`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "שמירה נכשלה");
      setBusy(false);
    }
  }

  const typeLabel = selected?.typology ? typologyLabels[selected.typology] : null;

  return (
    <div className="flow">
      <h1 className="page-title">{selected ? `לדרג את ${selected.name}` : "לדרג רחוב"}</h1>

      <ol className="flow-steps" aria-label="שלבים">
        {STEPS.map((s) => (
          <li
            key={s.n}
            aria-current={step === s.n ? "step" : undefined}
            data-done={step > s.n || undefined}
          >
            <span className="flow-step-n">{s.n}</span>
            <span className="flow-step-t">{s.title}</span>
          </li>
        ))}
      </ol>

      {error ? (
        <p role="alert" className="alert-warm mb-4">
          {error}
        </p>
      ) : null}

      {step === 1 ? (
        <section className="grid gap-4">
          <div className="step-guide">
            <p className="step-guide-title">שלב 1 מתוך 3: מה עושים כאן</p>
            <ol>
              <li>מקלידים את תחילת שם הרחוב.</li>
              <li>לוחצים על הרחוב ברשימה שנפתחת.</li>
              {needsQuarter ? <li>בוחרים באיזה רובע הקטע שאתם מדרגים.</li> : null}
              <li>לוחצים על הכפתור ״להמשיך לשאלות״.</li>
            </ol>
          </div>

          <div className="field">
            <label htmlFor="street" className="field-label">
              שם הרחוב<span className="req" aria-hidden="true"> *</span>
            </label>
            <input
              id="street"
              value={query}
              required
              aria-required="true"
              onChange={(e) => {
                setQuery(e.target.value);
                setSelected(null);
                setQuarterId("");
                setTypologySuggestion("");
              }}
              placeholder="למשל: רוגוזין"
              autoComplete="off"
              role="combobox"
              aria-expanded={matches.length > 0 && !selected}
              aria-controls="street-matches"
              className="input"
            />

            {selected ? null : matches.length > 0 ? (
              <ul id="street-matches" className="mt-2 grid gap-1">
                {matches.map(({ street, synonym }) => (
                  <li key={street.code}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelected(street);
                        setQuery(street.name);
                        setQuarterId("");
                      }}
                      className="option"
                    >
                      {street.name}
                      {synonym ? (
                        <span className="block text-[12px] text-ink-faint">ידוע גם כ־{synonym}</span>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
            ) : query.trim().length > 0 ? (
              <div className="mt-2 text-[14px] text-ink-soft">
                <p>לא מצאנו רחוב בשם הזה.</p>
                <p>בדקו את האיות, או הקלידו רק חלק מהשם.</p>
                <Link
                  href={`/suggest?name=${encodeURIComponent(query.trim())}`}
                  className="inline-link text-accent underline underline-offset-2"
                >
                  להציע את {query.trim()} כרחוב שאינו ברשימה
                </Link>
              </div>
            ) : null}
          </div>

          {needsQuarter ? (
            <div className="field">
              <label htmlFor="quarter" className="field-label">
                באיזה רובע הקטע?<span className="req" aria-hidden="true"> *</span>
              </label>
              <p className="field-help">{selected?.name} עובר בכמה רובעים.</p>
              <p className="field-help">כל קטע מדורג בנפרד.</p>
              <select
                id="quarter"
                value={quarterId}
                required
                onChange={(e) => setQuarterId(e.target.value)}
                className="input"
              >
                <option value="">בחרו רובע</option>
                {segmentQuarters.map((q) => (
                  <option key={q.id} value={q.id}>
                    {q.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          {selected ? (
            <div className="output-panel">
              <p className="output-label">התוצאה: הרחוב שבחרתם</p>
              <p className="output-value">
                {selected.name}
                {quarterName ? ` · ${quarterName}` : ""}
              </p>
              <p className="output-row">
                <span className="output-key">סוג הרחוב</span>
                <span className="output-val">{typeLabel ?? "טרם נקבע"}</span>
              </p>
              <p className="source-line">
                {selected.typologySource === "staff"
                  ? "נקבע על ידי צוות אדריכלות העיר."
                  : selected.typologySource === "gis"
                    ? "הערכה לפי שכבת הרחובות של העירייה. הצוות יאשר או יתקן."
                    : "אין עדיין סיווג לרחוב הזה."}
              </p>
            </div>
          ) : null}

          {selected ? (
            <details className="type-details" open={Boolean(typologySuggestion) || !selected.typology}>
              <summary className="type-summary">
                <span className="field-label">
                  לדעתכם הסוג אחר? <span className="opt">(לא חובה)</span>
                </span>
                <span className="field-help">
                  {typologies.length} סוגי רחובות, ומה מאפיין כל אחד. אם הסוג שלמעלה נכון, אפשר לדלג.
                </span>
              </summary>
            <fieldset className="field">
              <legend className="sr-only">איזה סוג רחוב זה?</legend>
              <p className="field-help">הסוג קובע מול אילו רחובות משווים את הרחוב.</p>
              <div className="type-grid">
                {typologies.map((t) => (
                  <label key={t.key} className="type-option" data-current={selected.typology === t.key || undefined}>
                    <input
                      type="radio"
                      name="typology"
                      value={t.key}
                      checked={typologySuggestion === t.key}
                      onChange={() => setTypologySuggestion(t.key)}
                    />
                    <span className="type-option-title">
                      {t.label}
                      {selected.typology === t.key ? <span className="chip">הסיווג הנוכחי</span> : null}
                    </span>
                    <span className="type-option-text">{t.description}</span>
                  </label>
                ))}
              </div>
              {typologySuggestion ? (
                <button type="button" className="btn btn-quiet mt-2" onClick={() => setTypologySuggestion("")}>
                  לבטל את הבחירה
                </button>
              ) : null}
            </fieldset>
            </details>
          ) : null}

          <div className="next-step">
            <p className="next-step-label">
              {step1Valid ? "השלב הבא: 7 שאלות קצרות על הרחוב." : needsQuarter ? "כדי להמשיך: לבחור רובע." : "כדי להמשיך: לבחור רחוב מהרשימה."}
            </p>
            <button type="button" disabled={!step1Valid} onClick={() => go(2)} className="btn btn-primary btn-wide">
              להמשיך לשאלות
            </button>
          </div>

          <p className="source-line">
            רשימת הרחובות: {registrySource}, כולל שמות מקובלים שאינם השם הרשמי. סוג הרחוב: שכבת הרחובות של עיריית אשדוד.
          </p>
        </section>
      ) : null}

      {step === 2 ? (
        <section className="grid gap-4">
          <div className="step-guide">
            <p className="step-guide-title">שלב 2 מתוך 3: מה עושים כאן</p>
            <ol>
              <li>קוראים כל שאלה.</li>
              <li>בוחרים ציון מ-1 (גרוע) עד 5 (מצוין).</li>
              <li>לא בטוחים מה נשאל? ״מה זה?״ פותח הסבר.</li>
            </ol>
          </div>

          <div className="output-panel output-inline">
            <span className="output-label">מדרגים את</span>
            <span className="output-value">
              {selected?.name}
              {needsQuarter ? ` · ${quarterName}` : ""}
            </span>
            <button type="button" onClick={() => go(1)} className="link-btn">
              לשנות רחוב
            </button>
          </div>

          <p className="progress-line" aria-live="polite">
            <span className="num">{answered}</span> מתוך <span className="num">{questions.length}</span> שאלות
            <span className="progress-bar" aria-hidden="true">
              <span style={{ width: `${(answered / questions.length) * 100}%` }} />
            </span>
          </p>

          {questions.map((question, i) => (
            <fieldset key={question.key} className="question-card" data-done={scores[question.key] ? "" : undefined}>
              <div className="flex items-start gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={
                    question.hasImage
                      ? imageSlotUrl(imageSlot("question", question.key))
                      : `/criteria/${question.key}.svg`
                  }
                  alt=""
                  width={44}
                  height={44}
                  className="mt-[2px] h-11 w-11 shrink-0 rounded-[10px] object-cover"
                />
                <div className="min-w-0 flex-1">
                  <legend className="question-title">
                    <span className="num text-ink-faint">{i + 1}.</span> {question.label}
                    <span className="req" aria-hidden="true"> *</span>
                  </legend>
                  <p className="question-help">{question.help}</p>
                  {question.criteria.length > 0 ? (
                    <details className="mb-2">
                      <summary className="summary-link">מה זה?</summary>
                      <div className="mt-1 border-e-2 border-line pe-2">
                        {question.criteria.map((criterion) => (
                          <p key={criterion.key} className="text-[13px] text-ink-soft">
                            <span className="font-semibold text-ink">{criterion.name}.</span> {criterion.text}
                          </p>
                        ))}
                      </div>
                    </details>
                  ) : null}
                  <ScaleInput
                    name={question.label}
                    value={scores[question.key]}
                    onChange={(value) => setScores((s) => ({ ...s, [question.key]: value }))}
                  />
                </div>
              </div>
            </fieldset>
          ))}

          <div className="next-step">
            <p className="next-step-label">
              {step2Valid
                ? "השלב הבא: משפט במילים שלכם ותמונה. שניהם לא חובה."
                : `כדי להמשיך: לענות עוד על ${questions.length - answered} ${questions.length - answered === 1 ? "שאלה" : "שאלות"}.`}
            </p>
            <button type="button" disabled={!step2Valid} onClick={() => go(3)} className="btn btn-primary btn-wide">
              להמשיך למילים ולתמונה
            </button>
            <button type="button" onClick={() => go(1)} className="link-btn">
              חזרה לשלב 1
            </button>
          </div>

          <p className="source-line">הסולם: {SCALE_STEPS.map((s) => `${s.value} ${s.label}`).join(" · ")}.</p>
        </section>
      ) : null}

      {step === 3 && selected ? (
        <section className="grid gap-5">
          <div className="step-guide">
            <p className="step-guide-title">שלב 3 מתוך 3: מה עושים כאן</p>
            <ol>
              <li>כותבים, או מקליטים, משפט על הרחוב.</li>
              <li>מוסיפים תמונה: מצלמים, גוררים, או מדביקים מ-Street View.</li>
              <li>לוחצים ״לשלוח את הדירוג״.</li>
            </ol>
            <p className="mt-1 text-[13px] text-ink-soft">שני הסעיפים הראשונים לא חובה. הדירוג נספר גם בלעדיהם.</p>
          </div>

          <div className="output-panel">
            <p className="output-label">התוצאה: הדירוג שלכם ל{selected.name}</p>
            <ul className="score-summary">
              {questions.map((q) => (
                <li key={q.key}>
                  <span>{q.label}</span>
                  <span className="score-dot" data-v={scores[q.key]}>
                    {scores[q.key]}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="field">
            <label htmlFor="reason" className="field-label">
              למה דווקא הרחוב הזה? <span className="opt">(לא חובה)</span>
            </label>
            <VoiceText id="reason" value={reason} onChange={setReason} placeholder="משפט או שניים במילים שלכם." />
          </div>

          <PhotoDrop streetName={selected.name} center={selected.center} value={photo} onChange={setPhoto} />

          <div className="next-step">
            <p className="next-step-label">אחרי השליחה: תגיעו לדף הרחוב, ותראו את הדירוג שלכם מול שאר התושבים.</p>
            <button type="button" disabled={busy} onClick={submit} className="btn btn-primary btn-wide">
              {busy ? "שולח…" : photo ? "לשלוח את הדירוג עם התמונה" : "לשלוח את הדירוג"}
            </button>
            <button type="button" onClick={() => go(2)} className="link-btn">
              חזרה לשאלות
            </button>
          </div>

          <p className="source-line">
            קול בלי תמונה נספר בדיוק כמו קול עם תמונה. לכל רחוב נשמר קול אחד מכל תושב, ושליחה חוזרת מעדכנת אותו.
            התמונה מוקטנת במכשיר, נתוני המיקום שבה נמחקים, והיא מתפרסמת רק אחרי אישור הצוות. נא להימנע מפנים ומלוחיות רישוי.
          </p>
        </section>
      ) : null}
    </div>
  );
}
