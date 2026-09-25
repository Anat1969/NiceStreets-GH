/** Hebrew counts read wrong with a bare numeral at one and two. */
export function votesLabel(count: number): string {
  if (count === 0) return "אין קולות";
  if (count === 1) return "קול אחד";
  if (count === 2) return "שני קולות";
  return `${count.toLocaleString("he-IL")} קולות`;
}

export function photosLabel(count: number): string {
  if (count === 0) return "אין תמונות";
  if (count === 1) return "תמונה אחת";
  if (count === 2) return "שתי תמונות";
  return `${count.toLocaleString("he-IL")} תמונות`;
}

export function streetsFoundLabel(count: number): string {
  if (count === 0) return "לא נמצאו רחובות";
  if (count === 1) return "נמצא רחוב אחד";
  if (count === 2) return "נמצאו שני רחובות";
  return `נמצאו ${count.toLocaleString("he-IL")} רחובות`;
}
