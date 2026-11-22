/** PDF import, page rasterisation and PDF export. Uses pdf.js for reading and jsPDF for writing. */
import * as pdfjs from 'pdfjs-dist';
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { jsPDF } from 'jspdf';
import type { NNoteDocument, Page } from '../types/model';
import { A4 } from '../types/model';
import { uid } from '../types/model';
import { renderScene, PALETTES } from '../canvas/renderer';
import { assetUrl } from '../store/editor';

pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

export interface PdfImport {
  pages: Page[];
  assets: Map<string, Blob>;
  sourceAsset: string;
}

export async function importPdf(file: File): Promise<PdfImport> {
  const buffer = await file.arrayBuffer();
  const task = pdfjs.getDocument({ data: new Uint8Array(buffer) });
  const pdf = await task.promise;
  const assets = new Map<string, Blob>();
  const sourceAsset = `assets/source-${Date.now()}.pdf`;
  assets.set(sourceAsset, new Blob([buffer], { type: 'application/pdf' }));

  const pages: Page[] = [];
  for (let i = 0; i < pdf.numPages; i++) {
    const pdfPage = await pdf.getPage(i + 1);
    const base = pdfPage.getViewport({ scale: 1 });
    const scale = Math.min(2.2, Math.max(1.2, 1500 / base.width));
    const viewport = pdfPage.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await pdfPage.render({ canvas, canvasContext: ctx, viewport }).promise;
    const blob = await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b!), 'image/png'));
    const name = `assets/pdf-${Date.now()}-${i}.png`;
    assets.set(name, blob);
    pages.push({
      uid: uid(),
      // PDF pages are rasterised to fit the fixed A4 canvas.
      width: A4.width,
      height: A4.height,
      pdf_page: i,
      pdf_asset: name,
      style: { pattern: 'none', page_color: [255, 255, 255, 255] },
      items: [],
    });
  }
  return { pages, assets, sourceAsset };
}

/** Raster PDF export of the current document, one page per PDF page. */
export async function exportPdf(doc: NNoteDocument, name: string, theme: 'light' | 'dark' | 'oled' = 'light'): Promise<Blob> {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  pdf.setProperties({ title: name });
  const palette = PALETTES[theme];
  for (let i = 0; i < doc.pages.length; i++) {
    const page = doc.pages[i];
    if (i > 0) pdf.addPage();
    const canvas = document.createElement('canvas');
    const scale = 1.5;
    canvas.width = Math.round(page.width * scale);
    canvas.height = Math.round(page.height * scale);
    const ctx = canvas.getContext('2d')!;
    renderScene({
      ctx, width: canvas.width, height: canvas.height, dpr: scale,
      doc, pageIndex: i, zoom: 1, origin: { x: 0, y: 0 }, theme,
      selection: [], assetUrl, useCache: false, ruler: { visible: false, y: 0, angle: 0, locked: false },
    });
    // Repaint without the app background so exported pages are paper-only.
    ctx.fillStyle = palette.paper;
    ctx.globalCompositeOperation = 'destination-over';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = 'source-over';
    const img = canvas.toDataURL('image/jpeg', 0.88);
    const pw = pdf.internal.pageSize.getWidth();
    const ph = pdf.internal.pageSize.getHeight();
    pdf.addImage(img, 'JPEG', 0, 0, pw, Math.min(ph, (page.height / page.width) * pw));
  }
  return pdf.output('blob');
}
