import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth-context';
import { hasPermission } from '@ligare/shared';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';

export function PatientsPage() {
  const { user } = useAuth();
  const [patients, setPatients] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ mrn: '', firstName: '', lastName: '', dob: '', phone: '', phoneAlt: '', email: '', insuranceProvider: '', insuranceId: '', notes: '' });
  const [error, setError] = useState('');

  const canCreate = user && hasPermission(user.role, 'calls:create');

  async function loadPatients() {
    setLoading(true);
    try {
      const params: Record<string, string> = { page: String(page), limit: '25' };
      if (search) params.q = search;
      const res = await api.getPatients(params);
      setPatients(res.data);
      setTotal(res.total);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadPatients(); }, [page, search]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await api.createPatient(form);
      setShowCreate(false);
      setForm({ mrn: '', firstName: '', lastName: '', dob: '', phone: '', phoneAlt: '', email: '', insuranceProvider: '', insuranceId: '', notes: '' });
      loadPatients();
    } catch (err: any) {
      setError(err.message);
    }
  }

  const totalPages = Math.ceil(total / 25);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-zinc-900">Patients</h1>
        <div className="flex gap-3">
          {canCreate && (
            <>
              <Link
                to="/patients/import"
                className="rounded-md bg-zinc-600 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 transition"
              >
                📥 Import CSV
              </Link>
              <button
                onClick={() => setShowCreate(!showCreate)}
                className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 transition"
              >
                + New Patient
              </button>
            </>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <input
          type="text"
          placeholder="Search by name, MRN, phone, or email..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-3 pl-10 text-sm shadow-sm focus:border-brand-500 focus:ring-brand-500"
        />
        <span className="absolute left-3 top-3 text-zinc-400">🔍</span>
      </div>

      {/* Create form */}
      {showCreate && (
        <Card>
          <CardHeader><CardTitle>New Patient</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <input required placeholder="MRN *" value={form.mrn} onChange={(e) => setForm({ ...form, mrn: e.target.value })} className="rounded border border-zinc-300 px-3 py-2 text-sm" />
              <input required placeholder="First Name *" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} className="rounded border border-zinc-300 px-3 py-2 text-sm" />
              <input required placeholder="Last Name *" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} className="rounded border border-zinc-300 px-3 py-2 text-sm" />
              <input type="date" placeholder="DOB" value={form.dob} onChange={(e) => setForm({ ...form, dob: e.target.value })} className="rounded border border-zinc-300 px-3 py-2 text-sm" />
              <input required placeholder="Phone *" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="rounded border border-zinc-300 px-3 py-2 text-sm" />
              <input placeholder="Alt Phone" value={form.phoneAlt} onChange={(e) => setForm({ ...form, phoneAlt: e.target.value })} className="rounded border border-zinc-300 px-3 py-2 text-sm" />
              <input placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="rounded border border-zinc-300 px-3 py-2 text-sm" />
              <input placeholder="Insurance Provider" value={form.insuranceProvider} onChange={(e) => setForm({ ...form, insuranceProvider: e.target.value })} className="rounded border border-zinc-300 px-3 py-2 text-sm" />
              <input placeholder="Insurance ID" value={form.insuranceId} onChange={(e) => setForm({ ...form, insuranceId: e.target.value })} className="rounded border border-zinc-300 px-3 py-2 text-sm" />
              <textarea placeholder="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="rounded border border-zinc-300 px-3 py-2 text-sm md:col-span-3" rows={2} />
              {error && <p className="text-red-600 text-sm md:col-span-3">{error}</p>}
              <div className="md:col-span-3 flex gap-2">
                <button type="submit" className="rounded bg-brand-600 px-4 py-2 text-sm text-white hover:bg-brand-700">Create</button>
                <button type="button" onClick={() => setShowCreate(false)} className="rounded bg-zinc-200 px-4 py-2 text-sm hover:bg-zinc-300">Cancel</button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-zinc-400">Loading...</div>
          ) : patients.length === 0 ? (
            <div className="p-8 text-center text-zinc-400">No patients found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-zinc-50 text-left text-xs font-medium uppercase text-zinc-500">
                  <tr>
                    <th className="px-4 py-3">MRN</th>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">DOB</th>
                    <th className="px-4 py-3">Phone</th>
                    <th className="px-4 py-3">Insurance</th>
                    <th className="px-4 py-3">Calls</th>
                    <th className="px-4 py-3">Tags</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {patients.map((p) => (
                    <tr key={p.id} className="hover:bg-zinc-50 cursor-pointer" onClick={() => window.location.href = `/patients/${p.id}`}>
                      <td className="px-4 py-3 font-mono text-xs font-medium text-brand-700">{p.mrn}</td>
                      <td className="px-4 py-3 font-medium">{p.firstName} {p.lastName}</td>
                      <td className="px-4 py-3 text-zinc-500">{p.dob ? new Date(p.dob).toLocaleDateString() : '—'}</td>
                      <td className="px-4 py-3 text-zinc-500">{p.phone}</td>
                      <td className="px-4 py-3 text-zinc-500">{p.insuranceProvider || '—'}</td>
                      <td className="px-4 py-3"><span className="rounded-full bg-brand-100 px-2 py-0.5 text-xs font-medium text-brand-800">{p.callCount}</span></td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {(p.tags || []).map((t: string) => (
                            <span key={t} className="rounded bg-zinc-200 px-1.5 py-0.5 text-xs">{t}</span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-zinc-500">
          <span>{total} patients total</span>
          <div className="flex gap-2">
            <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="rounded border px-3 py-1 disabled:opacity-50">← Prev</button>
            <span className="px-2 py-1">Page {page} of {totalPages}</span>
            <button disabled={page >= totalPages} onClick={() => setPage(page + 1)} className="rounded border px-3 py-1 disabled:opacity-50">Next →</button>
          </div>
        </div>
      )}
    </div>
  );
}
