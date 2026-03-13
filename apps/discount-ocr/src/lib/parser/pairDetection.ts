import { calculateDiscountedPrice } from './calculateDiscountedPrice';
import { extractDiscountCandidates } from './extractDiscountCandidates';
import { extractPriceCandidates } from './extractPriceCandidates';
import { normalizeText } from './normalizeText';
import type { DetectionSummary } from '../../types/ocr';

export function buildDetectionSummary(input: string): DetectionSummary {
  const normalizedText = normalizeText(input);
  const priceCandidates = extractPriceCandidates(normalizedText);
  const discountCandidates = extractDiscountCandidates(normalizedText);
  const selectedPrice = priceCandidates[0];
  const selectedDiscount = discountCandidates[0];

  return {
    normalizedText,
    priceCandidates,
    discountCandidates,
    selectedPrice,
    selectedDiscount,
    discountedPrice:
      selectedPrice && selectedDiscount
        ? calculateDiscountedPrice(selectedPrice.value, selectedDiscount.rate)
        : undefined,
  };
}
