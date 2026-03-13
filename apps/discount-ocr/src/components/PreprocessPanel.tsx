type PreprocessPanelProps = {
  enabled: boolean;
  isLoading: boolean;
  processedPreviewUrl?: string;
  onToggle: () => void;
};

export function PreprocessPanel({ enabled, isLoading, processedPreviewUrl, onToggle }: PreprocessPanelProps) {
  return (
    <section className="panel">
      <div className="panel-header">
        <h2>前処理</h2>
        <p>OpenCV.js でグレースケール + ぼかし + adaptive threshold を適用します。</p>
      </div>

      <div className="camera-actions">
        <button className="secondary-button" onClick={onToggle}>
          {enabled ? '前処理ON' : '前処理OFF'}
        </button>
        {isLoading ? <span className="small-note">OpenCV.js 読み込み中…</span> : null}
      </div>

      {processedPreviewUrl ? (
        <div className="preview-wrapper">
          <img className="preview-image" src={processedPreviewUrl} alt="前処理後プレビュー" />
        </div>
      ) : (
        <div className="preview-placeholder">前処理後プレビューはここに出ます。</div>
      )}
    </section>
  );
}
