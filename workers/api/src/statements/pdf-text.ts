type PdfTextItem = { str?: string; transform?: number[] };

export async function extractPdfText(
  bytes: Uint8Array,
  password?: string,
): Promise<{ ok: true; text: string } | { ok: false; error: "password_required" | "password_rejected" | "unreadable" }> {
  try {
    const pdfjs = await import("pdfjs-dist/build/pdf.mjs");
    const document = await pdfjs
      .getDocument({
        data: bytes,
        password,
        verbosity: pdfjs.VerbosityLevel?.ERRORS ?? 0,
        isEvalSupported: false,
        useSystemFonts: true,
      })
      .promise;
    const lines: string[] = [];
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      let line = "";
      let lastY: number | null = null;
      for (const item of content.items as PdfTextItem[]) {
        if (!item.str) continue;
        const y = item.transform?.[5];
        if (lastY != null && typeof y === "number" && Math.abs(y - lastY) > 2) {
          lines.push(line.trim());
          line = "";
        }
        line += `${item.str} `;
        if (typeof y === "number") lastY = y;
      }
      if (line.trim()) lines.push(line.trim());
    }
    await document.destroy();
    return { ok: true, text: lines.join("\n") };
  } catch (error) {
    const name = error instanceof Error ? error.name : "";
    const code = typeof error === "object" && error && "code" in error ? Number(error.code) : 0;
    if (name === "PasswordException" && code === 2) return { ok: false, error: "password_rejected" };
    if (name === "PasswordException") return { ok: false, error: "password_required" };
    return { ok: false, error: "unreadable" };
  }
}
