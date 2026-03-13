# discount-ocr

React + Tesseract.js based PoC for recognizing price/discount text from an image and calculating the discounted price.

## Current status
- Static image upload PoC
- OCR runs inside a Web Worker
- Rule-based parsing for:
  - `10%`
  - `30%OFF`
  - `1割引`〜`10割引`
  - `半額`
- Debug panel for raw OCR text and parser output

## Planned next steps
- Camera preview + frame capture
- OCR loop for near real-time recognition
- OpenCV.js preprocessing
- ROI overlay and temporal smoothing

## Development
```bash
npm install
npm run dev
```

## Build
```bash
npm run build
```

## Notes
- Tesseract.js is selected for the first iteration because it is easy to ship in-browser and good enough for a narrow OCR target domain.
- If accuracy is insufficient after preprocessing and parser tuning, compare with a browser-friendly PaddleOCR/ONNX alternative.
