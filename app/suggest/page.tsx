import ReportForm from "@/components/ReportForm";
import { CITY } from "@/lib/city";
import { STREET_REGISTRY_SOURCE } from "@/lib/streets";
import { segmentQuarters } from "@/lib/segments";

export const dynamic = "force-dynamic";

export const metadata = { title: "רחוב שאינו ברשימה — הרחובות הטובים של אשדוד" };

/**
 * הצעת רחוב שאינו ברשימת הרחובות הרשמית.
 *
 * הרשימה מגיעה מהמרשם הלאומי, ולכן חסרים בה מקומות שיש להם שם בפי התושבים
 * ואין להם שורה במרשם: מעבר בין בתים, טיילת, שביל. הדרך היחידה לצוות לדעת
 * על איזה מקום מדובר היא תמונה, ולכן כאן היא חובה.
 */
export default async function SuggestPage({
  searchParams,
}: {
  searchParams: Promise<{ name?: string }>;
}) {
  const { name } = await searchParams;

  return (
    <>
      <h1 className="mb-1 text-[24px] font-bold text-ink">רחוב שאינו ברשימה</h1>
      <p className="mb-4 text-[15px] text-ink-soft">
        רשימת הרחובות מבוססת על {STREET_REGISTRY_SOURCE}, ולכן חסרים בה מקומות
        שיש להם שם בפי תושבי {CITY.name} ואין להם שורה במרשם. אפשר להציע מקום כזה,
        והצוות יבדוק אם להוסיף אותו.
      </p>

      <ReportForm
        kind="street_suggestion"
        streetName={(name ?? "").slice(0, 120)}
        quarters={segmentQuarters()}
      />
    </>
  );
}
