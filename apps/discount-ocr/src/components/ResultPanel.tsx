import type { DetectionSummary } from '../types/ocr';

type ResultPanelProps = {
  status: string;
  progress: number;
  summary?: DetectionSummary;
};

export function ResultPanel({ status, progress, summary }: ResultPanelProps) {
  const selectedPrice = summary?.selectedPrice;
  const selectedDiscount = summary?.selectedDiscount;

  return (
    <section className="panel">
      <div className="panel-header">
        <h2>3. 認識結果</h2>
        <p>正規化とルールベース抽出を通した結果です。</p>
      </div>

      <div className="status-box">
        <strong>Status:</strong> {status}
        <div className="progress-bar">
          <div className="progress-bar-fill" style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>
      </div>

      <div className="result-grid">
        <div className="result-card">
          <span className="result-label">元値</span>
          <strong>{selectedPrice ? `${selectedPrice.value.toLocaleString()}円` : '未検出'}</strong>
        </div>
        <div className="result-card">
          <span className="result-label">割引</span>
          <strong>{selectedDiscount ? `${Math.round(selectedDiscount.rate * 100)}%` : '未検出'}</strong>
        </div>
        <div className="result-card result-card-accent">
          <span className="result-label">割引後価格</span>
          <strong>
            {typeof summary?.discountedPrice === 'number'
              ? `${summary.discountedPrice.toLocaleString()}円`
              : '計算待ち'}
          </strong>
        </div>
      </div>
    </section>
  );
}
