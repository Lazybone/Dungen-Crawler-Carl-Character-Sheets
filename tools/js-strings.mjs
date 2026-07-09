// Tokenizer für minifiziertes JavaScript: liefert alle Quoted-String-Literale
// mit Position und Vortext.
//
// Ein simpler /"(...)"/-Regex genügt hier nicht: Regex-Literale wie /[\s/]/ und
// verschachtelte Template-Literale (`Book ${n}, ${c===0?"start":`Ch. ${c}`}`)
// enthalten Anführungszeichen, an denen die Quote-Paarung verrutscht — danach
// gilt jedes Code-Fragment zwischen zwei Literalen selbst als Literal.

const REGEX_OK_BEFORE = new Set([..."(,=:[!&|?{};+-*%~^<>"]);

export function scanStringLiterals(src) {
  const out = [];
  let i = 0;
  let prev = ""; // letztes Zeichen ohne Whitespace; entscheidet / als Regex oder Division

  const skipString = (j) => {
    const quote = src[j];
    const start = ++j;
    let raw = "";
    while (j < src.length) {
      if (src[j] === "\\") { raw += src.slice(j, j + 2); j += 2; continue; }
      if (src[j] === quote) break;
      raw += src[j++];
    }
    let value = null;
    try {
      value = JSON.parse(`"${raw.replace(/\\'/g, "'").replace(/(?<!\\)"/g, '\\"')}"`);
    } catch { /* exotisches Escape: Literal überspringen */ }
    if (value !== null) {
      out.push({ value, index: start, before: src.slice(Math.max(0, start - 15), start - 1) });
    }
    return j + 1;
  };

  const skipRegex = (j) => {
    j++;
    let inClass = false;
    while (j < src.length) {
      const c = src[j];
      if (c === "\\") { j += 2; continue; }
      if (c === "[") inClass = true;
      else if (c === "]") inClass = false;
      else if (c === "/" && !inClass) { j++; break; }
      else if (c === "\n") break;
      j++;
    }
    while (j < src.length && /[a-z]/.test(src[j])) j++; // Flags
    return j;
  };

  // Überspringt `${ ... }` samt geschachtelter Strings, Templates und Regexe.
  const skipExpr = (j) => {
    let depth = 1;
    let p = "";
    while (j < src.length && depth > 0) {
      const c = src[j];
      if (c === '"' || c === "'") { j = skipString(j); p = '"'; continue; }
      if (c === "`") { j = skipTemplate(j); p = "`"; continue; }
      if (c === "/" && src[j + 1] === "/") { while (j < src.length && src[j] !== "\n") j++; continue; }
      if (c === "/" && REGEX_OK_BEFORE.has(p)) { j = skipRegex(j); p = "/"; continue; }
      if (c === "{") depth++;
      else if (c === "}") depth--;
      if (!/\s/.test(c)) p = c;
      j++;
    }
    return j;
  };

  const skipTemplate = (j) => {
    j++; // öffnender Backtick
    while (j < src.length) {
      const c = src[j];
      if (c === "\\") { j += 2; continue; }
      if (c === "`") return j + 1;
      if (c === "$" && src[j + 1] === "{") { j = skipExpr(j + 2); continue; }
      j++;
    }
    return j;
  };

  while (i < src.length) {
    const c = src[i];
    if (c === "/" && src[i + 1] === "/") { while (i < src.length && src[i] !== "\n") i++; continue; }
    if (c === "/" && src[i + 1] === "*") {
      const end = src.indexOf("*/", i + 2);
      i = end === -1 ? src.length : end + 2;
      continue;
    }
    if (c === "/" && (prev === "" || REGEX_OK_BEFORE.has(prev))) { i = skipRegex(i); prev = "/"; continue; }
    if (c === '"' || c === "'") { i = skipString(i); prev = '"'; continue; }
    if (c === "`") { i = skipTemplate(i); prev = "`"; continue; }
    if (!/\s/.test(c)) prev = c;
    i++;
  }
  return out;
}
