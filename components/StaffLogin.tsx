"use client";

import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";

/**
 * כניסת צוות בקישור שנשלח למייל. אין סיסמה ואין קוד משותף: מי שמקבל את
 * המייל הוא מי שנכנס, ומסד הנתונים בודק שהכתובת רשומה כצוות.
 *
 * התשובה על המסך זהה לכל כתובת, כדי שהמסך לא יגלה מי רשום כצוות.
 */
export default function StaffLogin() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "sent" | "error">("idle");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setState("busy");
    const { error } = await supabaseBrowser().auth.signInWithOtp({
      email: email.trim(),
      options: {
        // Exactly the address in Supabase's Redirect URLs list. Anything
        // extra (even ?next=) fails the match, and Supabase then silently
        // sends the link to the project's Site URL instead of back here.
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        shouldCreateUser: true,
      },
    });
    // A rate limit is the one failure worth telling apart; anything else
    // gets the same answer as success.
    setState(error && /rate|limit/i.test(error.message) ? "error" : "sent");
  }

  if (state === "sent") {
    return (
      <div role="status" className="rounded-[12px] border border-line bg-surface px-3 py-3 text-[15px] text-ink">
        <p className="font-medium">אם הכתובת רשומה כצוות, נשלח אליה קישור כניסה.</p>
        <p className="mt-1 text-[14px] text-ink-soft">
          הקישור פותח את לוח הבקרה בדפדפן שבו הוא נלחץ. כדאי לפתוח אותו באותו
          מכשיר ובאותו דפדפן שבו ביקשתם אותו.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="grid gap-2">
      <label htmlFor="email" className="text-[15px] text-ink">
        כתובת מייל
      </label>
      <input
        id="email"
        name="email"
        type="email"
        dir="ltr"
        required
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="rounded-[12px] border border-line bg-surface px-3 py-3 text-[16px]"
      />
      <button
        type="submit"
        disabled={state === "busy"}
        className="min-h-11 rounded-[14px] bg-accent px-5 py-3 text-[16px] font-medium text-white disabled:opacity-60"
      >
        {state === "busy" ? "שולחים…" : "שליחת קישור כניסה"}
      </button>
      {state === "error" ? (
        <p role="alert" className="text-[14px] text-ink">
          נשלחו יותר מדי קישורים בזמן קצר. אפשר לנסות שוב בעוד כמה דקות.
        </p>
      ) : null}
    </form>
  );
}
