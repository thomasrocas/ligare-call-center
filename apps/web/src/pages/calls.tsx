import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth-context';
import { hasPermission } from '@ligare/shared';
import { Button } from '../components/ui/button';
import { Select } from '../components/ui/select';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Modal } from '../components/ui/modal';
import { statusBadge, priorityBadge } from '../components/ui/badge';

export function CallsPage() {
  const { user } = useAuth();
  const [calls, setCalls] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ status: '', team: '', priority: '' });
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showTransfer, setShowTransfer] = useState<string | null>(null);
  const [categories, setCategories] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [activeTimer, setActiveTimer] = useState<Record<string, number>>({});

  const fetchCalls = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { page: String(page), limit: '20' };
      if (filters.status) params.status = filters.status;
      if (filters.team) params.team = filters.team;
      if (filters.priority) params.priority = filters.priority;
      const data = await api.getCalls(params);
      setCalls(data.data);
      setTotal(data.total);
    } catch (err) {
      console.error('Failed to fetch calls:', err);
    } finally {
      setLoading(false);
    }
  }, [page, filters]);

  useEffect(() => { fetchCalls(); }, [fetchCalls]);

  useEffect(() => {
    api.getCategories().then(setCategories).catch(() => {});
    if (hasPermission(user!.role, 'users:manage')) {
      api.getUsers().then(setUsers).catch(() => {});
    }
  }, [user]);

  // Live timer for in-progress calls
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const timers: Record<string, number> = {};
      calls.forEach((c) => {
        if (c.status === 'IN_PROGRESS' && c.startedAt) {
          timers[c.id] = Math.round((now - new Date(c.startedAt).getTime()) / 1000);
        }
      });
      setActiveTimer(timers);
    }, 1000);
    return () => clearInterval(interval);
  }, [calls]);

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handleStart = async (id: string) => {
    await api.startCall(id);
    fetchCalls();
  };

  const handleComplete = async (id: string) => {
    await api.completeCall(id);
    fetchCalls();
  };

  const handleExport = () => {
    const params: Record<string, string> = {};
    if (filters.status) params.status = filters.status;
    if (filters.team) params.team = filters.team;
    api.exportCalls(params);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Call Management</h1>
        <div className="flex gap-2">
          {hasPermission(user!.role, 'exports:csv') && (
            <Button variant="secondary" onClick={handleExport}>📥 Export CSV</Button>
          )}
          {hasPermission(user!.role, 'calls:create') && (
            <Button onClick={() => setShowCreate(true)}>+ New Call</Button>
          )}
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-4 flex-wrap">
            <Select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
              <option value="">All Statuses</option>
              <option value="QUEUED">Queued</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="COMPLETED">Completed</option>
              <option value="TRANSFERRED">Transferred</option>
              <option value="MISSED">Missed</option>
            </Select>
            <Select value={filters.team} onChange={(e) => setFilters({ ...filters, team: e.target.value })}>
              <option value="">All Teams</option>
              <option value="HH">HH</option>
              <option value="HO">HO</option>
            </Select>
            <Select value={filters.priority} onChange={(e) => setFilters({ ...filters, priority: e.target.value })}>
              <option value="">All Priorities</option>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="URGENT">Urgent</option>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Calls table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-zinc-50 text-left text-sm font-medium text-zinc-500">
                <th className="p-4">Caller</th>
                <th className="p-4">Phone</th>
                <th className="p-4">Category</th>
                <th className="p-4">Priority</th>
                <th className="p-4">Status</th>
                <th className="p-4">Team</th>
                <th className="p-4">Agent</th>
                <th className="p-4">Duration</th>
                <th className="p-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="p-8 text-center text-zinc-400">Loading...</td></tr>
              ) : calls.length === 0 ? (
                <tr><td colSpan={9} className="p-8 text-center text-zinc-400">No calls found</td></tr>
              ) : (
                calls.map((call) => (
                  <tr key={call.id} className="border-b hover:bg-zinc-50 transition-colors">
                    <td className="p-4 font-medium">{call.callerName}</td>
                    <td className="p-4 text-zinc-600">{call.callerPhone}</td>
                    <td className="p-4 text-zinc-600">{call.categoryName}</td>
                    <td className="p-4">{priorityBadge(call.priority)}</td>
                    <td className="p-4">{statusBadge(call.status)}</td>
                    <td className="p-4">{call.team}</td>
                    <td className="p-4 text-zinc-600">{call.agentName}</td>
                    <td className="p-4 font-mono text-sm">
                      {call.status === 'IN_PROGRESS' && activeTimer[call.id]
                        ? <span className="text-yellow-600">{formatDuration(activeTimer[call.id])}</span>
                        : call.duration
                        ? formatDuration(call.duration)
                        : '—'}
                    </td>
                    <td className="p-4">
                      <div className="flex gap-1">
                        {call.status === 'QUEUED' && hasPermission(user!.role, 'calls:start') && (
                          <Button variant="secondary" onClick={() => handleStart(call.id)} className="text-xs px-2 py-1">
                            ▶ Start
                          </Button>
                        )}
                        {call.status === 'IN_PROGRESS' && hasPermission(user!.role, 'calls:complete') && (
                          <Button variant="secondary" onClick={() => handleComplete(call.id)} className="text-xs px-2 py-1">
                            ✓ Complete
                          </Button>
                        )}
                        {(call.status === 'QUEUED' || call.status === 'IN_PROGRESS') && hasPermission(user!.role, 'calls:transfer') && (
                          <Button variant="secondary" onClick={() => setShowTransfer(call.id)} className="text-xs px-2 py-1">
                            ↗ Transfer
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {total > 20 && (
          <div className="flex items-center justify-between p-4 border-t">
            <span className="text-sm text-zinc-500">
              Showing {(page - 1) * 20 + 1}–{Math.min(page * 20, total)} of {total}
            </span>
            <div className="flex gap-2">
              <Button variant="secondary" disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</Button>
              <Button variant="secondary" disabled={page * 20 >= total} onClick={() => setPage(page + 1)}>Next</Button>
            </div>
          </div>
        )}
      </Card>

      {/* Create Call Modal */}
      <CreateCallModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        categories={categories}
        onCreated={fetchCalls}
      />

      {/* Transfer Modal */}
      <TransferModal
        open={!!showTransfer}
        callId={showTransfer}
        onClose={() => setShowTransfer(null)}
        users={users}
        onTransferred={fetchCalls}
      />
    </div>
  );
}

function CreateCallModal({ open, onClose, categories, onCreated }: any) {
  const [form, setForm] = useState({ callerName: '', callerPhone: '', categoryId: '', priority: 'MEDIUM', team: 'HH', notes: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.createCall(form);
      onCreated();
      onClose();
      setForm({ callerName: '', callerPhone: '', categoryId: '', priority: 'MEDIUM', team: 'HH', notes: '' });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="New Call">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Caller Name</label>
          <Input value={form.callerName} onChange={(e) => setForm({ ...form, callerName: e.target.value })} required />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Phone</label>
          <Input value={form.callerPhone} onChange={(e) => setForm({ ...form, callerPhone: e.target.value })} required />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Category</label>
            <Select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })} required>
              <option value="">Select...</option>
              {categories.filter((c: any) => c.active).map((c: any) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Priority</label>
            <Select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="URGENT">Urgent</option>
            </Select>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Team</label>
          <Select value={form.team} onChange={(e) => setForm({ ...form, team: e.target.value })}>
            <option value="HH">HH</option>
            <option value="HO">HO</option>
          </Select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Notes</label>
          <textarea
            className="flex w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            rows={3}
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={loading}>{loading ? 'Creating...' : 'Create Call'}</Button>
        </div>
      </form>
    </Modal>
  );
}

function TransferModal({ open, callId, onClose, users, onTransferred }: any) {
  const [transferredTo, setTransferredTo] = useState('');
  const [transferNotes, setTransferNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!callId) return;
    setLoading(true);
    try {
      await api.transferCall(callId, transferredTo, transferNotes);
      onTransferred();
      onClose();
      setTransferredTo('');
      setTransferNotes('');
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Transfer Call">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Transfer to</label>
          <Select value={transferredTo} onChange={(e) => setTransferredTo(e.target.value)} required>
            <option value="">Select agent...</option>
            {users.map((u: any) => (
              <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
            ))}
          </Select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Notes</label>
          <textarea
            className="flex w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            rows={3}
            value={transferNotes}
            onChange={(e) => setTransferNotes(e.target.value)}
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={loading}>{loading ? 'Transferring...' : 'Transfer'}</Button>
        </div>
      </form>
    </Modal>
  );
}
