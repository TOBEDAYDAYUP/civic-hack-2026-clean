const count = (text) => text.trim().split(/\s+/).filter(Boolean).length;
const plain = (text) =>
  String(text || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/https?:\/\/\S+/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/amend(?:ment to)? the Official Plan/gi, "change the City's long-term planning rules")
    .replace(/Zoning By-law(?: \d[\d-]*)?/gi, 'rules for what can be built on a property');
const sentence = (text) => (/[.!?]$/.test(text) ? text : text + '.');

/** Assemble existing source statements; do not invent project details or outcomes. */
export function introduction({ title, summary, location, status }) {
  const result = [];
  const add = (text, max = 80) => {
    text = plain(text);
    if (
      text &&
      !/^(not specified|unknown|n\/a)/i.test(text) &&
      count([...result, text].join(' ')) <= max
    )
      result.push(sentence(text));
  };
  const summaryText = plain(summary);
  const sentences = summaryText.split(/(?<=[.!?])\s+(?=[A-Z])/);
  for (const text of sentences) add(text, 42);
  if (!result.length)
    add(`This record concerns ${plain(title) || 'a City of Toronto public notice'}`, 42);
  if (location && !summaryText.toLowerCase().includes(plain(location).toLowerCase()))
    add(`The location listed is ${location}`, 58);
  add(status, 65);
  for (const text of [
    'Use the official record to check the proposal, dates and ways to take part.',
    'Check the linked City record for the full wording and any participation instructions before deciding what to do next.',
    'Read the details below for the information available in this record.',
    'The original City notice is linked below.',
  ]) {
    if (count(result.join(' ')) >= 50) break;
    add(text);
  }
  return result.join(' ');
}
