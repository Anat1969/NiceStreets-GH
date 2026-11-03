/* בתצוגה הסטטית אין שרת Next: refresh אינו עושה דבר. */
export function useRouter() {
  return { refresh() {}, push() {}, replace() {}, back() {}, prefetch() {} };
}
