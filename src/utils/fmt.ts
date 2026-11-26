/**
 * Inserts the arguments in place of the `{0}`, `{1}`, … placeholders of a translation template.
 * Every occurrence of a placeholder is replaced; placeholders without an argument stay unchanged.
 * Unlike `String.replace`, `$` characters in the arguments have no special meaning.
 */
export function fmt(template: string, ...args: ReadonlyArray<string | number>): string {
  return template.replace(/\{(\d+)\}/g, (match, index: string) => {
    const value = args[Number(index)];
    return value === undefined ? match : String(value);
  });
}
