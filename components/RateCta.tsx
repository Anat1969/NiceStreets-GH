"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export const ratedKey = (streetId: string) => `rated:${streetId}`;

/*
 * "לדרג את הרחוב" — רק למי שעוד לא דירג (ענת, 09.11.2026: "למה שוב לדרג?
 * הרי כבר דירגתם"). מי שדירג מהמכשיר הזה מקבל את הצעד הבא במקום:
 * רחוב נוסף, או עדכון של הדירוג שלו כקישור שקט.
 */
export default function RateCta({
  streetId,
  streetName,
  rateHref,
  justSaved,
}: {
  streetId: string;
  streetName: string;
  rateHref: string;
  justSaved: boolean;
}) {
  const [rated, setRated] = useState(justSaved);
  useEffect(() => {
    try {
      if (localStorage.getItem(ratedKey(streetId))) setRated(true);
    } catch {
      /* אין אחסון — מניחים שלא דורג. */
    }
  }, [streetId]);

  if (rated) {
    return (
      <>
        <p className="next-step-label">דירגתם את {streetName}. השלב הבא: רחוב נוסף שאתם מכירים.</p>
        <Link href="/choose" className="btn btn-primary btn-wide">
          לדרג רחוב נוסף
        </Link>
        <Link href={rateHref} className="link-btn">
          לעדכן את הדירוג שלי ל{streetName}
        </Link>
      </>
    );
  }
  return (
    <>
      <p className="next-step-label">מכירים את הרחוב? הדירוג לוקח פחות משתי דקות.</p>
      <Link href={rateHref} className="btn btn-primary btn-wide">
        לדרג את {streetName}
      </Link>
    </>
  );
}
