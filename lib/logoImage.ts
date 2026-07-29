import Jimp from 'jimp';

export class LogoValidationError extends Error {}

const MAX_BYTES = 5 * 1024 * 1024;
const OUTPUT_SIZE = 256;
const MIN_SOURCE_DIMENSION = 32;

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG_SIGNATURE = [0xff, 0xd8, 0xff];

function matchesSignature(bytes: Uint8Array, signature: number[]): boolean {
  if (bytes.length < signature.length) return false;
  return signature.every((byte, i) => bytes[i] === byte);
}

function isPngOrJpeg(bytes: Uint8Array): boolean {
  return matchesSignature(bytes, PNG_SIGNATURE) || matchesSignature(bytes, JPEG_SIGNATURE);
}

/**
 * Validates, decodes, and re-encodes an uploaded logo. Re-encoding (not just
 * passing the original bytes through) is what strips embedded
 * metadata/payloads — the decode step alone isn't enough.
 */
export async function processLogoUpload(bytes: ArrayBuffer): Promise<Buffer> {
  if (bytes.byteLength === 0) {
    throw new LogoValidationError('Uploaded file is empty.');
  }
  if (bytes.byteLength > MAX_BYTES) {
    throw new LogoValidationError('Logo must be 5MB or smaller.');
  }

  const view = new Uint8Array(bytes);
  if (!isPngOrJpeg(view)) {
    throw new LogoValidationError('Logo must be a PNG or JPEG image.');
  }

  let image: Jimp;
  try {
    image = await Jimp.read(Buffer.from(bytes));
  } catch {
    throw new LogoValidationError('Could not read this file as an image.');
  }

  if (image.bitmap.width < MIN_SOURCE_DIMENSION || image.bitmap.height < MIN_SOURCE_DIMENSION) {
    throw new LogoValidationError(`Image must be at least ${MIN_SOURCE_DIMENSION}x${MIN_SOURCE_DIMENSION}px.`);
  }

  image.cover(OUTPUT_SIZE, OUTPUT_SIZE);
  return image.getBufferAsync(Jimp.MIME_PNG);
}
