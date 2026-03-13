import { createWorker, type Block, type Line, type Page, type Worker, type Word } from 'tesseract.js';
import type { OcrLine, OcrResult, OcrWord } from '../types/ocr';

let workerPromise: Promise<Worker> | undefined;

async function getWorker() {
  if (!workerPromise) {
    workerPromise = createWorker('jpn+eng', 1, {
      logger(message) {
        if (message.status === 'recognizing text') {
          self.postMessage({ type: 'progress', progress: message.progress });
        }
      },
    });
  }
  return workerPromise;
}

function mapWord(word: Word, lineIndex: number): OcrWord {
  return {
    text: word.text,
    confidence: word.confidence,
    bbox: {
      x0: word.bbox.x0,
      y0: word.bbox.y0,
      x1: word.bbox.x1,
      y1: word.bbox.y1,
    },
    lineIndex,
  };
}

function collectLines(page: Page): OcrLine[] {
  const blocks = page.blocks ?? [];
  const rawLines: Line[] = blocks.flatMap((block: Block) =>
    block.paragraphs.flatMap((paragraph) => paragraph.lines),
  );

  return rawLines.map((line, lineIndex) => ({
    text: line.text.trim(),
    confidence: line.confidence,
    words: line.words.map((word) => mapWord(word, lineIndex)),
  }));
}

function mapResult(page: Page): OcrResult {
  const lines = collectLines(page);

  return {
    text: page.text,
    confidence: page.confidence,
    lines,
    words: lines.flatMap((line) => line.words),
  };
}

self.onmessage = async (event: MessageEvent<{ imageDataUrl: string }>) => {
  const targetWorker = await getWorker();

  try {
    const result = await targetWorker.recognize(event.data.imageDataUrl);

    self.postMessage({
      type: 'result',
      result: mapResult(result.data),
    });
  } catch (error) {
    self.postMessage({
      type: 'error',
      error: error instanceof Error ? error.message : 'Unknown OCR error',
    });
  }
};

export {};
