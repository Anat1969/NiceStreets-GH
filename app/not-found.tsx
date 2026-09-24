import Link from "next/link";

export default function NotFound() {
  return (
    <div className="py-10 text-center">
      <h1 className="mb-2 text-[24px] font-bold text-ink">הדף לא נמצא</h1>
      <p className="mb-4 text-[15px] text-ink-soft">ייתכן שהרחוב הוסר או שהקישור שגוי.</p>
      <Link href="/" className="text-[16px] text-accent underline">
        חזרה לעמוד הבית
      </Link>
    </div>
  );
}
