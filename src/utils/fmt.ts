/**
 * Wstawia argumenty w miejsca `{0}`, `{1}`, … szablonu tłumaczenia.
 * Każde wystąpienie znacznika jest zastępowane; znaczniki bez argumentu pozostają bez zmian.
 * W przeciwieństwie do `String.replace` znaki `$` w argumentach nie mają specjalnego znaczenia.
 */
export function fmt(template: string, ...args: ReadonlyArray<string | number>): string {
  return template.replace(/\{(\d+)\}/g, (match, index: string) => {
    const value = args[Number(index)];
    return value === undefined ? match : String(value);
  });
}
