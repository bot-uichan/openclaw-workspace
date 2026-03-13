# Discount OCR App — Implementation Checklist

## Goal
Build a React web app that recognizes a product price and discount text from an image/camera feed, then calculates and displays the discounted price.

## Selected approach
- OCR engine: `tesseract.js`
- Frontend: React + Vite + TypeScript
- OCR execution: Web Worker
- Image preprocessing: planned `OpenCV.js` phase
- Parsing strategy: OCR + normalization + rule-based extraction

## Phase 1 — Project foundation
- [x] Create repository/app scaffold
- [x] Decide first OCR approach
- [x] Define implementation phases
- [x] Define directory structure and major types
- [x] Add initial README

## Phase 2 — Static image OCR PoC
- [x] Add image upload UI
- [x] Add OCR worker
- [x] Show OCR progress and raw text
- [x] Keep OCR line/word level information when available
- [x] Add debug panel

## Phase 3 — Parsing pipeline
- [x] Normalize OCR text
- [x] Extract price candidates
- [x] Extract discount candidates (`%`, `割引`, `半額`)
- [x] Pair best price + discount candidate
- [x] Calculate discounted price
- [x] Show structured result card

## Phase 4 — Camera loop
- [x] Add camera permission + preview
- [x] Add manual frame capture from camera
- [x] Add periodic OCR loop with skip-when-busy behavior
- [x] Add ROI overlay
- [x] Preserve latest stable result

## Phase 5 — Accuracy / UX improvements
- [ ] Add OpenCV.js preprocessing
- [ ] Compare raw vs preprocessed OCR result
- [ ] Add temporal smoothing / voting
- [ ] Improve candidate scoring using bounding boxes
- [ ] Add failure-state UX

## Phase 6 — Hardening
- [ ] Add sample fixtures/tests for parser
- [ ] Measure OCR latency
- [ ] Tune mobile behavior
- [ ] Document known limitations
- [ ] Evaluate PaddleOCR-style browser alternative if needed

## Definition of done for MVP
- Image upload works
- OCR reads at least simple Japanese price/discount text
- Supports examples like `1280円`, `30%OFF`, `3割引`, `半額`
- Shows normalized interpretation and discounted total
- UI remains responsive during OCR
