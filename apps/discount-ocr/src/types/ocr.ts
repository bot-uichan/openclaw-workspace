export type Rect = {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
};

export type OcrWord = {
  text: string;
  confidence: number;
  bbox?: Rect;
  lineIndex?: number;
};

export type OcrLine = {
  text: string;
  confidence: number;
  words: OcrWord[];
};

export type OcrResult = {
  text: string;
  confidence: number;
  lines: OcrLine[];
  words: OcrWord[];
};

export type PriceCandidate = {
  value: number;
  text: string;
  normalizedText: string;
  score: number;
};

export type DiscountCandidate = {
  rate: number;
  text: string;
  normalizedText: string;
  score: number;
};

export type DetectionSummary = {
  normalizedText: string;
  priceCandidates: PriceCandidate[];
  discountCandidates: DiscountCandidate[];
  selectedPrice?: PriceCandidate;
  selectedDiscount?: DiscountCandidate;
  discountedPrice?: number;
};
