import { File } from 'expo-file-system';

/** Removes a local file if it is still there. Never throws. */
export function deleteFileQuietly(uri: string | null | undefined): void {
  if (!uri) return;
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    // Already gone or not ours; nothing to do.
  }
}
