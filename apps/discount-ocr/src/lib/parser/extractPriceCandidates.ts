import type { PriceCandidate } from '../../types/ocr';

export function extractPriceCandidates(normalizedText: string): PriceCandidate[] {
  const matches = [...normalizedText.matchAll(/(?:^|\s)(\d{1,3}(?:,\d{3})+|\d{2,6})\s*円?(?=$|\s)/g)];

  const candidates = matches
    .map((match) => {
      const raw = match[1];
      const value = Number(raw.replaceAll(',', ''));
      if (!Number.isFinite(value)) {
        return undefined;
      }

      let score = 0;
      if (match[0].includes('円')) score += 4;
      if (value >= 100) score += 3;
      if (value >= 1000) score += 2;
      if (value > 100000) score -= 3;
      if (value <= 100) score -= 2;

      return {
        value,
        text: match[0].trim(),
        normalizedText: raw,
        score,
      } satisfies PriceCandidate;
    })
    .filter((candidate): candidate is PriceCandidate => Boolean(candidate))
    .filter((candidate) => candidate.value >= 10)
    .sort((left, right) => right.score - left.score || right.value - left.value);

  return dedupeByValue(candidates);
}

function dedupeByValue(candidates: PriceCandidate[]): PriceCandidate[] {
  const seen = new Set<number>();
  return candidates.filter((candidate) => {
    if (seen.has(candidate.value)) return false;
    seen.add(candidate.value);
    return true;
  });
}
