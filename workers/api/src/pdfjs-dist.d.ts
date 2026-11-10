declare module "pdfjs-dist/build/pdf.mjs" {
  type PdfTextItem = { str?: string; transform?: number[] };
  type PdfPage = { getTextContent: () => Promise<{ items: PdfTextItem[] }> };
  type PdfDocument = { numPages: number; getPage: (page: number) => Promise<PdfPage>; destroy: () => Promise<void> };

  export function getDocument(params: {
    data: Uint8Array;
    password?: string;
    verbosity?: number;
    isEvalSupported?: boolean;
    useSystemFonts?: boolean;
  }): { promise: Promise<PdfDocument> };

  export const VerbosityLevel: { ERRORS?: number };
}
