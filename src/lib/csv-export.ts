/**
 * CSV Export utility for Qualiopi Generator
 */

export function exportToCSV(data: Record<string, unknown>[], filename: string, columns?: { key: string; label: string }[]) {
  if (data.length === 0) return;

  const keys = columns ? columns.map(c => c.key) : Object.keys(data[0]);
  const headers = columns ? columns.map(c => c.label) : keys;

  const csvContent = [
    headers.join(';'),
    ...data.map(row =>
      keys.map(key => {
        const val = row[key];
        if (val === null || val === undefined) return '';
        const str = String(val).replace(/"/g, '""');
        return `"${str}"`;
      }).join(';')
    ),
  ].join('\n');

  // BOM for Excel UTF-8 compatibility
  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
