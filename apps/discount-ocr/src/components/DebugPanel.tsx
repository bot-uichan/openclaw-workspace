import type { DetectionSummary, OcrResult } from '../types/ocr';

type DebugPanelProps = {
  ocrResult?: OcrResult;
  summary?: DetectionSummary;
  error?: string;
};

export function DebugPanel({ ocrResult, summary, error }: DebugPanelProps) {
  return (
    <section className="panel">
      <div className="panel-header">
        <h2>3. Debug</h2>
        <p>PoC段階ではここが本体です。何を読んで、どう解釈したかを全部見ます。</p>
      </div>

      {error ? <div className="error-box">{error}</div> : null}

      <div className="debug-section">
        <h3>OCR raw text</h3>
        <pre>{ocrResult?.text ?? 'まだOCR未実行です。'}</pre>
      </div>

      <div className="debug-section">
        <h3>Normalized text</h3>
        <pre>{summary?.normalizedText ?? '—'}</pre>
      </div>

      <div className="debug-section">
        <h3>Price candidates</h3>
        <pre>{JSON.stringify(summary?.priceCandidates ?? [], null, 2)}</pre>
      </div>

      <div className="debug-section">
        <h3>Discount candidates</h3>
        <pre>{JSON.stringify(summary?.discountCandidates ?? [], null, 2)}</pre>
      </div>

      <div className="debug-section">
        <h3>OCR lines</h3>
        <pre>{JSON.stringify(ocrResult?.lines ?? [], null, 2)}</pre>
      </div>
    </section>
  );
}
