/**
 * Picking, checking and storing PDFs on the device (US-31, BR-15).
 * Files live in Paths.document/documents/<userId>/<docId>.pdf.
 */

import * as DocumentPicker from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';
import { EncryptedPDFError, PDFDocument } from 'pdf-lib';

import { MAX_DOCUMENT_BYTES } from '@/domain/rules';
import type { PageRange } from '@/features/quota/quota';

export type PdfProblem = 'notPdf' | 'tooLarge' | 'encrypted' | 'unreadable' | 'noPages';

export class PdfCheckError extends Error {
  readonly problem: PdfProblem;
  constructor(problem: PdfProblem) {
    super(problem);
    this.problem = problem;
  }
}

export type PickedPdf = {
  /** Cache copy made by the picker. */
  uri: string;
  name: string;
  size: number;
  pageCount: number;
  pdf: PDFDocument;
};

/** Opens the system picker (Files, iCloud Drive, other providers). Null when cancelled. */
export async function pickPdfAsset(): Promise<DocumentPicker.DocumentPickerAsset | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: 'application/pdf',
    // iCloud and other providers hand out files we can only read from our own copy.
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (result.canceled) return null;
  return result.assets[0] ?? null;
}

function looksLikePdf(bytes: Uint8Array): boolean {
  // "%PDF" must appear in the first KB of the file.
  const head = bytes.subarray(0, 1024);
  for (let i = 0; i + 3 < head.length; i++) {
    if (head[i] === 0x25 && head[i + 1] === 0x50 && head[i + 2] === 0x44 && head[i + 3] === 0x46) return true;
  }
  return false;
}

/** File name without the .pdf extension, for the default title. */
export function titleFromFileName(name: string): string {
  return name.replace(/\.pdf$/i, '').replace(/[_]+/g, ' ').trim().slice(0, 80) || 'Belge';
}

/** Reads the picked file and checks size, type, encryption and page count. */
export async function readPickedPdf(asset: DocumentPicker.DocumentPickerAsset): Promise<PickedPdf> {
  const isPdfName = asset.name.toLowerCase().endsWith('.pdf');
  if (asset.mimeType && asset.mimeType !== 'application/pdf' && !isPdfName) throw new PdfCheckError('notPdf');
  if ((asset.size ?? 0) > MAX_DOCUMENT_BYTES) throw new PdfCheckError('tooLarge');

  const file = new File(asset.uri);
  if (file.size > MAX_DOCUMENT_BYTES) throw new PdfCheckError('tooLarge');
  const bytes = await file.bytes();
  if (bytes.byteLength > MAX_DOCUMENT_BYTES) throw new PdfCheckError('tooLarge');
  if (!looksLikePdf(bytes)) throw new PdfCheckError('notPdf');

  let pdf: PDFDocument;
  try {
    pdf = await PDFDocument.load(bytes, { ignoreEncryption: false, updateMetadata: false });
  } catch (error) {
    throw new PdfCheckError(error instanceof EncryptedPDFError ? 'encrypted' : 'unreadable');
  }
  const pageCount = pdf.getPageCount();
  if (pageCount < 1) throw new PdfCheckError('noPages');

  return { uri: asset.uri, name: asset.name, size: bytes.byteLength, pageCount, pdf };
}

function documentsDir(userId: string): Directory {
  const dir = new Directory(Paths.document, 'documents', userId);
  dir.create({ intermediates: true, idempotent: true });
  return dir;
}

/**
 * Saves the PDF for a document. When only part of it was chosen, a new PDF with just those
 * pages is written (pdf-lib copyPages), so only those pages are ever sent for processing.
 */
export async function saveDocumentFile(
  userId: string,
  docId: string,
  picked: PickedPdf,
  range: PageRange,
): Promise<{ uri: string; size: number }> {
  const dest = new File(documentsDir(userId), `${docId}.pdf`);
  const whole = range.from === 1 && range.to === picked.pageCount;

  if (whole) {
    await new File(picked.uri).copy(dest, { overwrite: true });
  } else {
    const out = await PDFDocument.create();
    const indices = Array.from({ length: range.to - range.from + 1 }, (_, i) => range.from - 1 + i);
    const pages = await out.copyPages(picked.pdf, indices);
    pages.forEach((page) => out.addPage(page));
    const bytes = await out.save();
    if (dest.exists) dest.delete();
    dest.create();
    await dest.write(bytes);
  }
  return { uri: dest.uri, size: dest.size };
}

export { deleteFileQuietly } from './storage';
