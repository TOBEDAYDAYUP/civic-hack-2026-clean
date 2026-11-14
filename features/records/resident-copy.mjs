import { addressLabel } from '../../lib/address-label.mjs';

// Presentation only: keep original source and evidence untouched.
export function cleanResidentText(value) {
  return String(value || '')
    .replace(/\b(?:latitude|longitude|lat|lng|lon)\s*[:=]\s*-?\d{1,3}\.\d+/gi, '')
    .replace(/\b43\.\d{3,}\s*[,;·|\s]+\s*-79\.\d{3,}\b/g, '')
    .replace(/-79\.\d{3,}\s*[,;·|\s]+\s*43\.\d{3,}\b/g, '')
    .replace(/\s*[·|]\s*(?=[·|,.]|$)/g, '')
    .replace(/([·|])\s*([,.;])/g, '$2')
    .replace(/\s+([,.;])/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

export function impactCopy(value, addressLabels = []) {
  let copy = String(value || '');
  for (const label of addressLabels) {
    if (!label) continue;
    const street = addressLabel(label);
    copy = copy.replaceAll(label, street);
    const escaped = street.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Public notice addresses may already be cleaned while an older saved
    // explanation still contains the complete geocoder label.
    const legacy = new RegExp(
      `Toronto\\s*[·|]\\s*Ontario\\s*[·|]\\s*43\\.\\d+\\s*[·|]\\s*-79\\.\\d+\\s*[·|]\\s*(?:[A-Z]\\d[A-Z]\\s?\\d[A-Z]\\d\\s*[·|]\\s*)?Canada\\s*[·|]\\s*${escaped}(?:\\s*[·|]\\s*${escaped}\\s+Toronto\\s+Ontario)?`,
      'gi',
    );
    copy = copy.replace(legacy, street);
  }
  return cleanResidentText(copy)
    .split(/(?<=[.!?])\s+(?=[A-Z])/)
    .filter(
      (sentence) =>
        !/^(?:this (?:notice|record|document)|the (?:notice|document)|adoption)\b.*\b(?:does not|cannot|doesn't)\b/i.test(
          sentence,
        ),
    )
    .filter((sentence) => !/^Residents looking for housing may wish to check/i.test(sentence))
    .join(' ');
}

const actionable =
  /\b(?:send|submit|email|e-mail|call|register|attend|speak|write|appeal|request)\b/i;
const generic = /^(?:see|read|check|consult|refer to|visit)\b.*\b(?:notice|source|website)\b/i;
export function residentActions(value, sourceText = '') {
  const saved = cleanResidentText(value);
  if (
    saved &&
    actionable.test(saved) &&
    !generic.test(saved) &&
    !/^(?:not specified|not provided|unknown)/i.test(saved)
  )
    return [saved];
  // Quote specific instructions from the original notice instead of inventing
  // an action or repeating that nearby residents could be affected.
  const sentences = cleanResidentText(sourceText).split(/(?<=[.!?])\s+(?=[A-Z])/);
  return [
    ...new Set(
      sentences.filter(
        (sentence) =>
          sentence.length <= 750 &&
          /\b(?:you may (?:send|submit|email|call|register)|you are (?:also )?invited to address|if you (?:wish|would like) to (?:speak|address|receive notice)|please (?:register|submit|send)|written comments (?:may|must|can|should))\b/i.test(
            sentence,
          ),
      ),
    ),
  ].slice(0, 3);
}
