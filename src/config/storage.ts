import { Client } from 'minio';
import { Readable } from 'stream';

// Object storage (MinIO, S3-compatible). The backend is the only client — files
// are streamed through the API (see /uploads handler), so the bucket stays private.
export const minioClient = new Client({
  endPoint: process.env.MINIO_ENDPOINT || 'minio',
  port: parseInt(process.env.MINIO_PORT || '9000', 10),
  useSSL: process.env.MINIO_USE_SSL === 'true',
  accessKey: process.env.MINIO_ACCESS_KEY || '',
  secretKey: process.env.MINIO_SECRET_KEY || '',
});

export const BUCKET = process.env.MINIO_BUCKET || 'dvla-uploads';

// Create the bucket on startup if missing. Retries because MinIO may come up
// slightly after the backend.
export async function ensureBucket(retries = 10): Promise<void> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const exists = await minioClient.bucketExists(BUCKET);
      if (!exists) await minioClient.makeBucket(BUCKET);
      console.log(`📦 Object storage ready (bucket: ${BUCKET})`);
      return;
    } catch (err) {
      if (attempt === retries) throw err;
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
}

export async function putObject(key: string, buffer: Buffer, contentType: string): Promise<void> {
  await minioClient.putObject(BUCKET, key, buffer, buffer.length, { 'Content-Type': contentType });
}

export function getObjectStream(key: string): Promise<Readable> {
  return minioClient.getObject(BUCKET, key);
}

export async function getObjectBuffer(key: string): Promise<Buffer> {
  const stream = await minioClient.getObject(BUCKET, key);
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks);
}

export function statObject(key: string) {
  return minioClient.statObject(BUCKET, key);
}
