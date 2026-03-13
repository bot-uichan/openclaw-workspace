type OpenCvModule = any;

let cvReadyPromise: Promise<OpenCvModule> | undefined;

export function loadOpenCv() {
  if (!cvReadyPromise) {
    cvReadyPromise = import('@techstark/opencv-js').then((module) => module as unknown as OpenCvModule);
  }
  return cvReadyPromise;
}

export async function preprocessImageDataUrl(imageDataUrl: string): Promise<string> {
  const cv = await loadOpenCv();
  const image = await loadImage(imageDataUrl);
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth || image.width;
  canvas.height = image.naturalHeight || image.height;
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Canvas context の取得に失敗しました。');
  }

  context.drawImage(image, 0, 0);

  const src = cv.imread(canvas);
  const gray = new cv.Mat();
  const blurred = new cv.Mat();
  const binary = new cv.Mat();

  try {
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY, 0);
    cv.GaussianBlur(gray, blurred, new cv.Size(3, 3), 0, 0, cv.BORDER_DEFAULT);
    cv.adaptiveThreshold(
      blurred,
      binary,
      255,
      cv.ADAPTIVE_THRESH_GAUSSIAN_C,
      cv.THRESH_BINARY,
      31,
      12,
    );

    cv.imshow(canvas, binary);
    return canvas.toDataURL('image/png');
  } finally {
    src.delete();
    gray.delete();
    blurred.delete();
    binary.delete();
  }
}

async function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('画像ロードに失敗しました。'));
    image.src = src;
  });
}
