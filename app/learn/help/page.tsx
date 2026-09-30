import { CITY, STATUSES } from "@/lib/city";
import { BackLink } from "@/components/learn-nav";
import { ButtonLink, Card } from "@/components/ui";

export const metadata = { title: "איך אתם עוזרים — ללמוד" };

export default function LearnHelpPage() {
  return (
    <>
      <BackLink href="/learn" label="ללמוד" />
      <h1 className="mb-1 text-[24px] font-bold text-ink">איך אתם עוזרים</h1>
      <p className="mb-5 text-[15px] text-ink-soft">
        מה קורה לקול שלכם אחרי שהוא נשמר.
      </p>

      <Card>
        <ol className="grid gap-3 text-[15px] text-ink">
          <li>
            <span className="font-medium">אתם בוחרים רחוב ומדרגים אותו</span>
            <span className="block text-[14px] text-ink-soft">
              שבע שאלות, ואם בא לכם גם נימוק ותמונה.
            </span>
          </li>
          <li>
            <span className="font-medium">הקול הופך לשורה בטבלה</span>
            <span className="block text-[14px] text-ink-soft">
              {CITY.authority} עובד איתה: אילו רחובות לשמר, היכן להוסיף עצים,
              ואיפה לתקן חתך.
            </span>
          </li>
          <li>
            <span className="font-medium">לכל רחוב נקבע סטטוס גלוי</span>
            <span className="block text-[14px] text-ink-soft">
              {STATUSES.map((s) => s.label).join(" · ")}. הסטטוס מופיע בכרטיס
              הרחוב ובעמוד הבית, ומתעדכן לעיני כולם.
            </span>
          </li>
        </ol>
      </Card>

      <div className="mt-4">
        <ButtonLink href="/choose">לבחור רחוב</ButtonLink>
      </div>
    </>
  );
}
