import type { DiscountCandidate } from '../../types/ocr';

export function extractDiscountCandidates(normalizedText: string): DiscountCandidate[] {
  const matches = [...normalizedText.matchAll(/([1-9]\d?|100)%/g)];

  const candidates = matches
    .map((match) => {
      const percent = Number(match[1]);
      if (!Number.isFinite(percent) || percent < 1 || percent > 100) {
        return undefined;
      }

      let score = 3;
      if (percent === 50) score += 1;
      if (percent % 10 === 0) score += 1;

      return {
        rate: percent / 100,
        text: match[0],
        normalizedText: match[0],
        score,
      } satisfies DiscountCandidate;
    })
    .filter((candidate): candidate is DiscountCandidate => Boolean(candidate))
    .sort((left, right) => right.score - left.score || right.rate - left.rate);

  return dedupeByRate(candidates);
}

function dedupeByRate(candidates: DiscountCandidate[]): DiscountCandidate[] {
  const seen = new Set<number>();
  return candidates.filter((candidate) => {
    if (seen.has(candidate.rate)) return false;
    seen.add(candidate.rate);
    return true;
  });
}
