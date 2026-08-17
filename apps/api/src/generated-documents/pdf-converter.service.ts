import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { execFile } from 'child_process';
import { mkdtemp, readFile, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { promisify } from 'util';

const run = promisify(execFile);

@Injectable()
export class PdfConverterService {
  private readonly binary: string;
  private readonly timeout: number;
  constructor(config: ConfigService) {
    this.binary = config.get('LIBREOFFICE_BINARY', 'libreoffice');
    this.timeout = Number(config.get('DOCUMENT_PDF_TIMEOUT_MS', 45000));
  }

  async convert(docx: Buffer) {
    const dir = await mkdtemp(join(tmpdir(), 'medcnx-doc-'));
    try {
      const input = join(dir, 'document.docx');
      await writeFile(input, docx);
      await run(
        this.binary,
        [
          '--headless',
          '--nologo',
          '--nodefault',
          '--nolockcheck',
          '--convert-to',
          'pdf',
          '--outdir',
          dir,
          input,
        ],
        {
          timeout: this.timeout,
          windowsHide: true,
          env: { ...process.env, HOME: dir },
        },
      );
      const pdf = await readFile(join(dir, 'document.pdf'));
      if (!pdf.subarray(0, 5).equals(Buffer.from('%PDF-')))
        throw new Error('Invalid PDF output.');
      return pdf;
    } catch (error) {
      throw new ServiceUnavailableException(
        `PDF conversion is unavailable. Install LibreOffice in the API runtime and set LIBREOFFICE_BINARY. ${error instanceof Error ? error.message : ''}`.trim(),
      );
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }
}
