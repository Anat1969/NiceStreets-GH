import "./street-media.css";

/*
 * מסגרת קטנה עם תמונת הרחוב: התמונה שצורפה לקול האחרון (latestPhotoId ב-
 * lib/stats.ts), ובלעדיה התמונה המאושרת החדשה ביותר. בלי תמונה — מסגרת ריקה
 * באותו גודל, כדי שהשורות לא יזוזו.
 */
export default function StreetThumb({
  photoId,
  name,
  width = 48,
  height = 36,
}: {
  photoId: string | null;
  name: string;
  width?: number;
  height?: number;
}) {
  return (
    <span className="street-thumb" style={{ width, height }} data-empty={photoId ? undefined : ""}>
      {photoId ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img src={`/api/photos/${photoId}`} alt={name} loading="lazy" width={width} height={height} />
      ) : null}
    </span>
  );
}
