import type { PhotonImage as PhotonImageType } from '@cf-wasm/photon/workerd';

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
 *
 * Uses @cf-wasm/photon (a WASM port of the Rust `photon` image library)
 * rather than a Node-oriented library. PNG decode/encode in the actual
 * Workers runtime needs a codec that doesn't depend on Node's private zlib
 * internals — jimp (via pngjs's sync codec, which subclasses Node's
 * internal zlib.Inflate/Deflate classes) decodes/encodes fine in plain
 * Node but throws in production Workers, since nodejs_compat only
 * implements the public zlib API, not those private internals. Photon's
 * WASM build has no such dependency.
 *
 * The `@cf-wasm/photon/workerd` import is deferred to inside this function
 * (rather than a top-level import) because its raw ESM `.wasm` import only
 * resolves correctly once Cloudflare's own Worker bundler processes it —
 * Next's build-time "collecting page data" step imports route modules in
 * plain Node to statically inspect their exports, and a top-level import
 * here would execute (and fail) during that step too.
 */
export async function processLogoUpload(bytes: ArrayBuffer): Promise<Uint8Array> {
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

  const { PhotonImage, SamplingFilter, Rgba, crop, padding_uniform, resize } = await import(
    '@cf-wasm/photon/workerd'
  );

  let input: PhotonImageType;
  try {
    input = PhotonImage.new_from_byteslice(view);
  } catch (err) {
    console.error('Photon failed to decode uploaded logo:', err);
    throw new LogoValidationError('Could not read this file as an image.');
  }

  try {
    const width = input.get_width();
    const height = input.get_height();
    if (width < MIN_SOURCE_DIMENSION || height < MIN_SOURCE_DIMENSION) {
      throw new LogoValidationError(`Image must be at least ${MIN_SOURCE_DIMENSION}x${MIN_SOURCE_DIMENSION}px.`);
    }

    const aspectRatio = width / height;

    if (aspectRatio >= 0.8 && aspectRatio <= 1.25) {
      // Near-square: crop to centered square, then resize to 256x256
      const side = Math.min(width, height);
      const x1 = Math.floor((width - side) / 2);
      const y1 = Math.floor((height - side) / 2);

      const cropped = crop(input, x1, y1, x1 + side, y1 + side);
      try {
        const resized = resize(cropped, OUTPUT_SIZE, OUTPUT_SIZE, SamplingFilter.Lanczos3);
        try {
          return resized.get_bytes();
        } finally {
          resized.free();
        }
      } finally {
        cropped.free();
      }
    } else {
      // Non-square (wide banner or tall logo): contain fit inside 200px box + pad to 256x256
      const TARGET_INNER_BOX = 200;
      let targetW: number;
      let targetH: number;

      if (width > height) {
        targetW = TARGET_INNER_BOX;
        targetH = Math.max(1, Math.round(TARGET_INNER_BOX / aspectRatio));
      } else {
        targetH = TARGET_INNER_BOX;
        targetW = Math.max(1, Math.round(TARGET_INNER_BOX * aspectRatio));
      }

      const scaled = resize(input, targetW, targetH, SamplingFilter.Lanczos3);
      try {
        const padX = Math.max(1, Math.floor((OUTPUT_SIZE - targetW) / 2));
        const p1 = padding_uniform(scaled, padX, new Rgba(255, 255, 255, 255));
        try {
          const currentH = p1.get_height();
          const padY = Math.max(1, Math.floor((OUTPUT_SIZE - currentH) / 2));
          const p2 = padding_uniform(p1, padY, new Rgba(255, 255, 255, 255));
          try {
            const side = OUTPUT_SIZE;
            const x1 = Math.max(0, Math.floor((p2.get_width() - side) / 2));
            const y1 = Math.max(0, Math.floor((p2.get_height() - side) / 2));
            const finalSquare = crop(p2, x1, y1, x1 + side, y1 + side);
            try {
              return finalSquare.get_bytes();
            } finally {
              finalSquare.free();
            }
          } finally {
            p2.free();
          }
        } finally {
          p1.free();
        }
      } finally {
        scaled.free();
      }
    }
  } finally {
    input.free();
  }
}
