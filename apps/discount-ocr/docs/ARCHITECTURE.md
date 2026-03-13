# Architecture

## Pipeline

```text
Image/Camera Frame
  -> preprocess (future OpenCV.js)
  -> OCR worker (tesseract.js)
  -> normalize text
  -> extract price candidates
  -> extract discount candidates
  -> pick best pair
  -> calculate discounted price
  -> render result/debug UI
```

## Main UI components
- `App`: top-level orchestration/state
- `ImageUploadPanel`: upload a still image for PoC
- `CameraPanel`: planned live camera preview/capture
- `ResultPanel`: structured recognition result
- `DebugPanel`: OCR raw output, normalized text, candidates

## Logic modules
- `src/lib/ocr/recognizeImage.ts`: main-thread OCR request helper
- `src/workers/ocrWorker.ts`: worker hosting Tesseract
- `src/lib/parser/normalizeText.ts`: OCR cleanup and Japanese discount normalization
- `src/lib/parser/extractPriceCandidates.ts`: price candidate extraction
- `src/lib/parser/extractDiscountCandidates.ts`: discount candidate extraction
- `src/lib/parser/pairDetection.ts`: choose best price/discount pair
- `src/lib/parser/calculateDiscountedPrice.ts`: final price calculation

## Types
- `OcrWord`
- `OcrResult`
- `PriceCandidate`
- `DiscountCandidate`
- `DetectionSummary`

## Notes
- OCR is intentionally isolated behind a worker boundary so camera mode can reuse the same API later.
- Parsing is rule-based because the target domain is narrow and predictable.
- Bounding boxes are retained for future ROI scoring and pairing improvements.
