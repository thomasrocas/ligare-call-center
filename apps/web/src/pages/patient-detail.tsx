import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth-context';
import { hasPermission } from '@ligare/shared';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';

const statusColors: Record<string, string> = {
  QUEUED: 'bg-yellow-100 text-yellow-800',
  IN_PROGRESS: 'bg-blue-100 text-blue-800',
  COMPLETED: 'bg-green-100 text-green-800',
  TRANSFERRED: 'bg-purple-100 text-purple-800',
  MISSED: 'bg-red-100 text-red-800',
};

const priorityColors: Record<string, string> = {
  LOW: 'bg-zinc-100 text-zinc-700',
  MEDIUM: 'bg-blue-100 text-blue-700',
  HIGH: 'bg-orange-100 text-orange-700',
  URGENT: 'bg-red-100 text-red-700',
};

export function PatientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [patient, setPatient] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<any>({});
  const [error, setError] = useState('');

  const canEdit = user && hasPermission(user.role, 'calls:create');

  async function loadPatient() {
    try {
      const data = await api.getPatient(id!);
      setPatient(data);
      setForm({
        firstName: data.firstName,
        lastName: data.lastName,
        dob: data.dob ? data.dob.slice(0, 10) : '',
        phone: data.phone,
        phoneAlt: data.phoneAlt || '',
        email: data.email || '',
        preferredLanguage: data.preferredLanguage || 'en',
        insuranceProvider: data.insuranceProvider || '',
        insuranceId: data.insuranceId || '',
        notes: data.notes || '',
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadPatient(); }, [id]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await api.updatePatient(id!, form);
      setEditing(false);
      loadPatient();
    } catch (err: any) {
      setError(err.message);
    }
  }

  if (loading) return <div className="text-center text-zinc-400 py-8">Loading...</div>;
  if (!patient) return <div className="text-center text-zinc-400 py-8">Patient not found</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/patients')} className="text-brand-600 hover:text-brand-800 text-sm">← Back to Patients</button>
        <h1 className="text-2xl font-bold text-zinc-900">{patient.firstName} {patient.lastName}</h1>
        <span className="rounded-full bg-brand-100 px-3 py-1 text-sm font-mono font-medium text-brand-800">{patient.mrn}</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Demographics */}
        <div className="lg:col-span-1 space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Patient Info</CardTitle>
                {canEdit && !editing && (
                  <button onClick={() => setEditing(true)} className="text-xs text-brand-600 hover:text-brand-800">✏️ Edit</button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {editing ? (
                <form onSubmit={handleSave} className="space-y-3">
                  <input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} placeholder="First Name" className="w-full rounded border px-3 py-2 text-sm" />
                  <input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} placeholder="Last Name" className="w-full rounded border px-3 py-2 text-sm" />
                  <input type="date" value={form.dob} onChange={(e) => setForm({ ...form, dob: e.target.value })} className="w-full rounded border px-3 py-2 text-sm" />
                  <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Phone" className="w-full rounded border px-3 py-2 text-sm" />
                  <input value={form.phoneAlt} onChange={(e) => setForm({ ...form, phoneAlt: e.target.value })} placeholder="Alt Phone" className="w-full rounded border px-3 py-2 text-sm" />
                  <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Email" className="w-full rounded border px-3 py-2 text-sm" />
                  <input value={form.insuranceProvider} onChange={(e) => setForm({ ...form, insuranceProvider: e.target.value })} placeholder="Insurance Provider" className="w-full rounded border px-3 py-2 text-sm" />
                  <input value={form.insuranceId} onChange={(e) => setForm({ ...form, insuranceId: e.target.value })} placeholder="Insurance ID" className="w-full rounded border px-3 py-2 text-sm" />
                  <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Notes" className="w-full rounded border px-3 py-2 text-sm" rows={3} />
                  {error && <p className="text-red-600 text-sm">{error}</p>}
                  <div className="flex gap-2">
                    <button type="submit" className="rounded bg-brand-600 px-3 py-1.5 text-sm text-white hover:bg-brand-700">Save</button>
                    <button type="button" onClick={() => setEditing(false)} className="rounded bg-zinc-200 px-3 py-1.5 text-sm hover:bg-zinc-300">Cancel</button>
                  </div>
                </form>
              ) : (
                <dl className="space-y-3 text-sm">
                  <div><dt className="text-zinc-400">DOB</dt><dd className="font-medium">{patient.dob ? new Date(patient.dob).toLocaleDateString() : '—'}</dd></div>
                  <div><dt className="text-zinc-400">Phone</dt><dd className="font-medium">{patient.phone}</dd></div>
                  {patient.phoneAlt && <div><dt className="text-zinc-400">Alt Phone</dt><dd className="font-medium">{patient.phoneAlt}</dd></div>}
                  {patient.email && <div><dt className="text-zinc-400">Email</dt><dd className="font-medium">{patient.email}</dd></div>}
                  <div><dt className="text-zinc-400">Language</dt><dd className="font-medium">{patient.preferredLanguage}</dd></div>
                  {patient.insuranceProvider && <div><dt className="text-zinc-400">Insurance</dt><dd className="font-medium">{patient.insuranceProvider} — {patient.insuranceId}</dd></div>}
                  {patient.notes && <div><dt className="text-zinc-400">Notes</dt><dd className="font-medium whitespace-pre-wrap">{patient.notes}</dd></div>}
                </dl>
              )}
            </CardContent>
          </Card>

          {/* Tags */}
          <Card>
            <CardHeader><CardTitle>Tags</CardTitle></CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {(patient.tags || []).length === 0 ? (
                  <span className="text-sm text-zinc-400">No tags</span>
                ) : (
                  patient.tags.map((t: string) => (
                    <span key={t} className="rounded-full bg-brand-100 px-3 py-1 text-sm font-medium text-brand-800">{t}</span>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Call History */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Call History ({patient.calls?.length || 0})</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {(!patient.calls || patient.calls.length === 0) ? (
                <div className="p-8 text-center text-zinc-400">No calls recorded</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-zinc-50 text-left text-xs font-medium uppercase text-zinc-500">
                      <tr>
                        <th className="px-4 py-3">Date</th>
                        <th className="px-4 py-3">Category</th>
                        <th className="px-4 py-3">Agent</th>
                        <th className="px-4 py-3">Priority</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Duration</th>
                        <th className="px-4 py-3">Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {patient.calls.map((c: any) => (
                        <tr key={c.id} className="hover:bg-zinc-50">
                          <td className="px-4 py-3 text-zinc-500 whitespace-nowrap">{new Date(c.createdAt).toLocaleString()}</td>
                          <td className="px-4 py-3">{c.categoryName}</td>
                          <td className="px-4 py-3">{c.agentName}</td>
                          <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${priorityColors[c.priority] || ''}`}>{c.priority}</span></td>
                          <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[c.status] || ''}`}>{c.status}</span></td>
                          <td className="px-4 py-3 text-zinc-500">{c.duration ? `${Math.floor(c.duration / 60)}m ${c.duration % 60}s` : '—'}</td>
                          <td className="px-4 py-3 text-zinc-500 max-w-[200px] truncate">{c.notes || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
