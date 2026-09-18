/**
 * Serialize structured data for an inline `<script type="application/ld+json">`.
 *
 * Plain `JSON.stringify` is not safe there: the HTML parser ends the script at
 * the first `</script>` no matter what JSON string it sits in, so a listing
 * description containing `</script><script>…` would run as page script (the
 * CSP allows inline scripts). Escaping `<`, `>` and `&` as JSON unicode escapes
 * keeps the parsed value identical while leaving nothing the HTML tokenizer can
 * act on. U+2028/U+2029 are escaped too — valid in JSON, but historically line
 * terminators in JS.
 */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}
