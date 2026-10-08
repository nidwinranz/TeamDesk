/** Reads a text field from FormData (files and missing fields become ''). */
export function formString(form: FormData, key: string): string {
  const v = form.get(key);
  return typeof v === 'string' ? v : '';
}
