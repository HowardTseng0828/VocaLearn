// Minimal CSV parser that handles quoted fields and embedded commas/newlines.
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;

  const normalized = text.replace(/\r\n?/g, "\n");
  for (let i = 0; i < normalized.length; i++) {
    const c = normalized[i];
    if (inQuotes) {
      if (c === '"') {
        if (normalized[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += c;
    }
  }
  // Flush the final field/row if the file doesn't end with a newline.
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

// Heuristic POS extractor for 2-column input (word, "<pos><meaning>").
const POS_RE = /^((?:[a-z]+\.\s*)(?:\/\s*[a-z]+\.\s*)*)+/i;
export function splitPosMeaning(rest: string): { pos: string; meaning: string } {
  const m = rest.match(POS_RE);
  if (!m) return { pos: "", meaning: rest.trim() };
  let pos = m[0].replace(/\s+/g, " ").trim();
  const parts = pos.split(" ");
  pos = parts.filter((p, idx) => parts.indexOf(p) === idx).join(" ");
  return { pos, meaning: rest.slice(m[0].length).trim() };
}
