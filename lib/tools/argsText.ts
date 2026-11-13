/**
 * The config generator's Args box is one line of text, but a config's `args`
 * is an array: `"C:/My Files"` has to stay one argument. Splitting on
 * whitespace turned it into `"C:/My` and `Files"`.
 *
 * Shell-like rules, kept Windows-friendly: whitespace separates arguments,
 * "double" or 'single' quotes group text (and are removed), and a backslash
 * escapes only a quote or whitespace, so `C:\Users\me` keeps its backslashes
 * (and `"C:\Program Files\"` keeps its trailing one).
 * An unclosed quote runs to the end of the line.
 */
export function parseArgsText(text: string): string[] {
  const args: string[] = [];
  let current = '';
  let inArg = false;
  let quote: '"' | "'" | null = null;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];
    if (quote) {
      if (ch === quote) {
        quote = null;
      } else if (
        ch === '\\' &&
        quote === '"' &&
        next === '"' &&
        // `"C:\Program Files\"` is a Windows folder, not an escaped quote: a
        // \" that ends the word closes the quote and keeps the backslash.
        i + 2 < text.length &&
        !/\s/.test(text[i + 2])
      ) {
        current += '"';
        i++;
      } else {
        current += ch;
      }
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      inArg = true;
    } else if (ch === '\\' && next !== undefined && /["'\s]/.test(next)) {
      current += next;
      inArg = true;
      i++;
    } else if (/\s/.test(ch)) {
      if (inArg) args.push(current);
      current = '';
      inArg = false;
    } else {
      current += ch;
      inArg = true;
    }
  }
  if (inArg) args.push(current);
  return args;
}

/** Inverse of parseArgsText: quotes any argument that would not survive a round trip. */
export function formatArgsText(args: readonly string[]): string {
  return args
    .map((arg) => {
      // A bare backslash already round-trips (it only escapes a quote or space).
      if (arg !== '' && !/["'\s]/.test(arg)) return arg;
      // In double quotes a trailing backslash would escape the closing quote;
      // single quotes are fully literal.
      if (!arg.includes('"') && !arg.endsWith('\\')) return `"${arg}"`;
      if (!arg.includes("'")) return `'${arg}'`;
      // Both quote kinds: single-quote the rest and splice each ' in as "'".
      return arg
        .split("'")
        .map((part) => `'${part}'`)
        .join(`"'"`);
    })
    .join(' ');
}
