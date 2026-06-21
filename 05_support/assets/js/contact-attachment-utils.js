export const DEFAULT_WEBP_QUALITY = 0.82;

export function normalizeWebpQuality(value) {
  const quality = Number(value);
  return Number.isFinite(quality) && quality > 0 && quality <= 1 ? quality : DEFAULT_WEBP_QUALITY;
}

export function toWebpFilename(name) {
  const trimmed = String(name || '').trim();
  const fallback = trimmed || 'attachment';
  const withoutExtension = fallback.replace(/\.[^./\\]+$/, '');
  return `${withoutExtension || 'attachment'}.webp`;
}

export function readBlobAsBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => {
      const result = String(reader.result || '');
      resolve(result.includes(',') ? result.split(',')[1] : result);
    });
    reader.addEventListener('error', () => reject(reader.error || new Error('file_read_failed')));
    reader.readAsDataURL(blob);
  });
}

function readBlobAsDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => resolve(String(reader.result || '')));
    reader.addEventListener('error', () => reject(reader.error || new Error('file_read_failed')));
    reader.readAsDataURL(blob);
  });
}

function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image), { once: true });
    image.addEventListener('error', () => reject(new Error('image_load_failed')), { once: true });
    image.src = dataUrl;
  });
}

function canvasToWebpBlob(canvas, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob && blob.type === 'image/webp') {
        resolve(blob);
      } else {
        reject(new Error('webp_conversion_failed'));
      }
    }, 'image/webp', normalizeWebpQuality(quality));
  });
}

export async function convertImageFileToWebp(file, quality) {
  if (!file || !file.type || !file.type.startsWith('image/')) {
    throw new Error('not_image_file');
  }

  const dataUrl = await readBlobAsDataUrl(file);
  const image = await loadImage(dataUrl);
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  if (!width || !height) {
    throw new Error('image_size_unavailable');
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('canvas_unavailable');
  }
  context.drawImage(image, 0, 0, width, height);

  const webpBlob = await canvasToWebpBlob(canvas, quality);
  const base64 = await readBlobAsBase64(webpBlob);
  return { file, webpBlob, base64 };
}

export function buildWebpAttachmentPayload({ file, webpBlob, base64 }) {
  return {
    name: toWebpFilename(file && file.name),
    mimeType: 'image/webp',
    size: webpBlob.size,
    data: base64,
    originalName: file && file.name ? file.name : '',
    originalMimeType: file && file.type ? file.type : '',
    originalSize: file && Number.isFinite(file.size) ? file.size : 0,
  };
}
