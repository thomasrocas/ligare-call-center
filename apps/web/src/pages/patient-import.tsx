import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
  return lines.slice(1).map((line) => {
    const values = line.match(/(".*?"|[^,]+)/g) || [];
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h] = (values[i] || '').trim().replace(/^"|"$/g, '');
    });
    return row;
  });
}

export function PatientImportPage() {
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState('');
  const [preview, setPreview] = useState<Record<string, string>[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setResult(null);
    setError('');

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const rows = parseCSV(text);
      if (rows.length === 0) {
        setError('No data found in CSV');
        return;
      }
      setHeaders(Object.keys(rows[0]));
      setPreview(rows.slice(0, 10));
    };
    reader.readAsText(file);
  }

  async function handleImport() {
    if (!fileRef.current?.files?.[0]) return;
    setImporting(true);
    setError('');
    setResult(null);

    try {
      const text = await fileRef.current.files[0].text();
      const rows = parseCSV(text);
      const res = await api.importPatients(rows);
      setResult(res);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/patients')} className="text-brand-600 hover:text-brand-800 text-sm">← Back to Patients</button>
        <h1 className="text-2xl font-bold text-zinc-900">Import Patients</h1>
      </div>

      {/* Instructions */}
      <Card>
        <CardHeader><CardTitle>CSV Format</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-zinc-600 mb-3">Upload a CSV file with the following columns. <strong>Bold</strong> columns are required.</p>
          <div className="overflow-x-auto">
            <table className="text-xs">
              <thead>
                <tr className="text-left text-zinc-500">
                  <th className="pr-6 py-1">Column</th>
                  <th className="pr-6 py-1">Required</th>
                  <th className="py-1">Example</th>
                </tr>
              </thead>
              <tbody className="text-zinc-700">
                <tr><td className="pr-6 py-1 font-bold">mrn</td><td className="pr-6">✅ Yes</td><td>MRN-001</td></tr>
                <tr><td className="pr-6 py-1 font-bold">firstName</td><td className="pr-6">✅ Yes</td><td>John</td></tr>
                <tr><td className="pr-6 py-1 font-bold">lastName</td><td className="pr-6">✅ Yes</td><td>Doe</td></tr>
                <tr><td className="pr-6 py-1 font-bold">phone</td><td className="pr-6">✅ Yes</td><td>555-123-4567</td></tr>
                <tr><td className="pr-6 py-1">dob</td><td className="pr-6">Optional</td><td>1985-06-15</td></tr>
                <tr><td className="pr-6 py-1">phoneAlt</td><td className="pr-6">Optional</td><td>555-999-0000</td></tr>
                <tr><td className="pr-6 py-1">email</td><td className="pr-6">Optional</td><td>john@example.com</td></tr>
                <tr><td className="pr-6 py-1">insuranceProvider</td><td className="pr-6">Optional</td><td>Blue Cross</td></tr>
                <tr><td className="pr-6 py-1">insuranceId</td><td className="pr-6">Optional</td><td>BC-12345</td></tr>
              </tbody>
            </table>
          </div>
          <p className="text-xs text-zinc-400 mt-3">Duplicate MRNs will update existing records. Max 10,000 rows per import.</p>
        </CardContent>
      </Card>

      {/* Upload */}
      <Card>
        <CardHeader><CardTitle>Upload File</CardTitle></CardHeader>
        <CardContent>
          <div
            className="border-2 border-dashed border-zinc-300 rounded-lg p-8 text-center hover:border-brand-400 transition cursor-pointer"
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (e.dataTransfer.files[0] && fileRef.current) {
                const dt = new DataTransfer();
                dt.items.add(e.dataTransfer.files[0]);
                fileRef.current.files = dt.files;
                fileRef.current.dispatchEvent(new Event('change', { bubbles: true }));
              }
            }}
          >
            <input ref={fileRef} type="file" accept=".csv" onChange={handleFile} className="hidden" />
            <p className="text-zinc-500 text-sm">
              {fileName ? `📄 ${fileName}` : '📂 Click or drag & drop a CSV file here'}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Preview */}
      {preview.length > 0 && !result && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Preview (first 10 rows)</CardTitle>
              <button
                onClick={handleImport}
                disabled={importing}
                className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50 transition"
              >
                {importing ? '⏳ Importing...' : '🚀 Import All'}
              </button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-zinc-50 text-left font-medium text-zinc-500">
                  <tr>{headers.map((h) => <th key={h} className="px-3 py-2">{h}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {preview.map((row, i) => (
                    <tr key={i} className="hover:bg-zinc-50">
                      {headers.map((h) => <td key={h} className="px-3 py-2">{row[h]}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error */}
      {error && (
        <Card>
          <CardContent><p className="text-red-600 text-sm">❌ {error}</p></CardContent>
        </Card>
      )}

      {/* Results */}
      {result && (
        <Card>
          <CardHeader><CardTitle>Import Results</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div className="rounded-lg bg-zinc-50 p-4 text-center">
                <div className="text-2xl font-bold text-zinc-900">{result.total}</div>
                <div className="text-xs text-zinc-500">Total Rows</div>
              </div>
              <div className="rounded-lg bg-green-50 p-4 text-center">
                <div className="text-2xl font-bold text-green-700">{result.created}</div>
                <div className="text-xs text-green-600">Created</div>
              </div>
              <div className="rounded-lg bg-blue-50 p-4 text-center">
                <div className="text-2xl font-bold text-blue-700">{result.updated}</div>
                <div className="text-xs text-blue-600">Updated</div>
              </div>
              <div className="rounded-lg bg-red-50 p-4 text-center">
                <div className="text-2xl font-bold text-red-700">{result.skipped}</div>
                <div className="text-xs text-red-600">Skipped</div>
              </div>
            </div>

            {result.errors?.length > 0 && (
              <div className="mt-4">
                <h4 className="text-sm font-medium text-red-700 mb-2">Errors:</h4>
                <div className="max-h-40 overflow-y-auto rounded border border-red-200 bg-red-50 p-3 text-xs">
                  {result.errors.map((e: any, i: number) => (
                    <div key={i} className="py-1">Row {e.row} (MRN: {e.mrn || 'none'}): {e.error}</div>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-4 flex gap-3">
              <button onClick={() => navigate('/patients')} className="rounded bg-brand-600 px-4 py-2 text-sm text-white hover:bg-brand-700">View Patients</button>
              <button onClick={() => { setResult(null); setPreview([]); setFileName(''); }} className="rounded bg-zinc-200 px-4 py-2 text-sm hover:bg-zinc-300">Import More</button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
