export const NOTIFICATION_IMAGE_MAX_BYTES = 10 * 1024 * 1024;
// Divisible by three so slices of a complete base64 string decode independently.
// Encoded chunks stay below Next.js's default 1 MB Server Action request limit.
export const NOTIFICATION_IMAGE_CHUNK_BYTES = 384 * 1024;
export const NOTIFICATION_IMAGE_CHUNK_BASE64_LENGTH = NOTIFICATION_IMAGE_CHUNK_BYTES / 3 * 4;
