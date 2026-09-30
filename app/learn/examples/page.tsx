import { redirect } from "next/navigation";

/**
 * ספריית הדוגמאות היא לשונית ראשית ב-/examples, ולכן העמוד הזה מפנה אליה
 * במקום להחזיק עותק שני של אותו תוכן בשתי כתובות.
 */
export default function LearnExamplesPage() {
  redirect("/examples");
}
