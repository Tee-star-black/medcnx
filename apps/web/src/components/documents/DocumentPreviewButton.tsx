'use client';

import { useEffect, useState } from 'react';
import {
  ExternalLink,
  Eye,
  Loader2,
  X,
} from 'lucide-react';

import { api } from '@/lib/api';

type DocumentPreviewButtonProps = {
  documentId: string;
  fileName: string;
  buttonLabel?: string;
};

export function DocumentPreviewButton({
  documentId,
  fileName,
  buttonLabel = 'Preview',
}: DocumentPreviewButtonProps) {
  const [previewUrl, setPreviewUrl] = useState('');
  const [mimeType, setMimeType] = useState('');
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  async function loadPreview() {
    setError('');
    setLoading(true);

    try {
      const response = await api.get<Blob>(
        `/employees/documents/${documentId}/download`,
        {
          responseType: 'blob',
        },
      );

      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }

      const rawContentType =
        response.headers['content-type'];

      const contentType =
        typeof rawContentType === 'string'
          ? rawContentType
          : 'application/octet-stream';

      const blob = new Blob([response.data], {
        type: contentType,
      });

      const objectUrl = URL.createObjectURL(blob);

      setMimeType(contentType);
      setPreviewUrl(objectUrl);
      setOpen(true);
    } catch (requestError: any) {
      const message =
        requestError?.response?.data?.message ??
        'Could not preview document.';

      setError(
        Array.isArray(message)
          ? message.join(' ')
          : String(message),
      );
    } finally {
      setLoading(false);
    }
  }

  function closePreview() {
    setOpen(false);
  }

  const canPreviewInFrame =
    mimeType.includes('pdf') ||
    mimeType.includes('html') ||
    mimeType.includes('text') ||
    mimeType.includes('image');

  return (
    <>
      <button
        type="button"
        onClick={loadPreview}
        disabled={loading}
        className="inline-flex items-center justify-center gap-2 border border-black/10 bg-white px-4 py-2 text-sm font-medium text-gray-600 transition hover:border-black hover:text-black disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? (
          <Loader2
            className="animate-spin"
            size={15}
          />
        ) : (
          <Eye size={15} />
        )}

        {buttonLabel}
      </button>

      {error ? (
        <p className="mt-2 text-sm text-red-600">
          {error}
        </p>
      ) : null}

      {open ? (
        <div className="fixed inset-0 z-[100] bg-black/70 px-4 py-6">
          <div className="mx-auto flex h-full max-w-6xl flex-col border border-black/10 bg-white shadow-2xl">
            <div className="flex flex-col gap-3 border-b border-black/10 px-5 py-4 md:flex-row md:items-center md:justify-between">
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-[0.2em] text-gray-400">
                  Document preview
                </p>

                <h2 className="mt-1 truncate text-lg font-semibold tracking-[-0.03em] text-[#111827]">
                  {fileName}
                </h2>

                <p className="mt-1 text-xs text-gray-500">
                  {mimeType}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                {previewUrl ? (
                  <a
                    href={previewUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center gap-2 border border-black/10 bg-white px-4 py-2 text-sm font-medium text-gray-600 transition hover:border-black hover:text-black"
                  >
                    <ExternalLink size={15} />
                    Open new tab
                  </a>
                ) : null}

                <button
                  type="button"
                  onClick={closePreview}
                  className="inline-flex items-center justify-center gap-2 border border-black bg-black px-4 py-2 text-sm font-medium text-white transition hover:bg-white hover:text-black"
                >
                  <X size={15} />
                  Close
                </button>
              </div>
            </div>

            <div className="flex-1 bg-[#f8fafc] p-4">
              {canPreviewInFrame && previewUrl ? (
                <iframe
                  title={`Preview ${fileName}`}
                  src={previewUrl}
                  className="h-full min-h-[70vh] w-full border border-black/10 bg-white"
                />
              ) : (
                <div className="flex h-full min-h-[70vh] items-center justify-center border border-dashed border-black/15 bg-white px-6 text-center">
                  <div>
                    <Eye
                      size={34}
                      className="mx-auto text-gray-300"
                    />

                    <p className="mt-4 text-sm font-medium text-[#111827]">
                      Preview unavailable for this file type
                    </p>

                    <p className="mt-1 max-w-md text-sm leading-6 text-gray-500">
                      This file can still be opened in a new tab or downloaded
                      from the document actions.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
