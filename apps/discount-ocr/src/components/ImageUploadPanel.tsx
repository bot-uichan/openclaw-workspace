type ImageUploadPanelProps = {
  disabled?: boolean;
  imagePreviewUrl?: string;
  onSelectFile: (file: File) => void;
};

export function ImageUploadPanel({ disabled, imagePreviewUrl, onSelectFile }: ImageUploadPanelProps) {
  return (
    <section className="panel">
      <div className="panel-header">
        <h2>1. 画像アップロード</h2>
        <p>まずは静止画 PoC。価格POP画像を1枚選んでOCRに通します。</p>
      </div>

      <label className={`upload-dropzone${disabled ? ' is-disabled' : ''}`}>
        <input
          type="file"
          accept="image/*"
          disabled={disabled}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) onSelectFile(file);
          }}
        />
        <span>{disabled ? 'OCR実行中です…' : '画像を選択'}</span>
      </label>

      {imagePreviewUrl ? (
        <div className="preview-wrapper">
          <img className="preview-image" src={imagePreviewUrl} alt="選択したOCR対象" />
        </div>
      ) : (
        <div className="preview-placeholder">ここに選択画像のプレビューが出ます。</div>
      )}
    </section>
  );
}
