// R196 (item 3.2c) — download a dataset's (or a saved copy's) rows as a file.
// The server names the file and stamps the data version into it.

import { datasetsApi } from '@/api/datasetsApi';

export async function downloadDatasetExport(datasetId: string, format: 'csv' | 'xlsx'): Promise<string> {
  const { blob, filename } = await datasetsApi.exportFile(datasetId, format);
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return filename;
}
