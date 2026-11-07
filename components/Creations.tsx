"use client";

import { useEffect } from "react";

declare module "react" {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      "app-creations": React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        src?: string;
        heading?: string;
      };
    }
  }
}

const PRIMARY = "https://anat1969.github.io/AppOfApp-GH/creations.js";
const FALLBACK = "https://appofapp-gh.vercel.app/creations.js";

/**
 * הרכיב המשותף <app-creations> (AppOfApp-GH/public/creations.js): כתבה בעמוד A4 לכל נושא,
 * "יצירת כתבה", הורדה והדפסה, והעלאה לחדר במוזיאון TAARUCHA. נטען קודם מ-GitHub Pages, ו-Vercel כגיבוי.
 * הנתונים: public/creations.json, נגזר מ-lib/city.ts ב-tools/creations.ts.
 */
export default function Creations() {
  useEffect(() => {
    if (customElements.get("app-creations") || document.querySelector("script[data-creations]")) return;
    const s = document.createElement("script");
    s.src = PRIMARY;
    s.dataset.creations = "1";
    s.onerror = () => {
      const f = document.createElement("script");
      f.src = FALLBACK;
      document.head.appendChild(f);
    };
    document.head.appendChild(s);
  }, []);
  return <app-creations src="/creations.json" heading="כתבות על הרחובות הטובים" />;
}
