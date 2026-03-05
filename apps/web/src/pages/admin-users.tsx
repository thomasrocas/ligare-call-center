import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { ROLES, TEAMS } from '@ligare/shared';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select } from '../components/ui/select';
import { Card } from '../components/ui/card';
import { Modal } from '../components/ui/modal';
import { Badge } from '../components/ui/badge';

export function AdminUsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editUser, setEditUser] = useState<any>(null);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      setUsers(await api.getUsers());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleDeactivate = async (id: string) => {
    if (!confirm('Deactivate this user?')) return;
    await api.deleteUser(id);
    fetchUsers();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">User Management</h1>
        <Button onClick={() => setShowCreate(true)}>+ New User</Button>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-zinc-50 text-left text-sm font-medium text-zinc-500">
                <th className="p-4">Name</th>
                <th className="p-4">Email</th>
                <th className="p-4">Role</th>
                <th className="p-4">Team</th>
                <th className="p-4">Status</th>
                <th className="p-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="p-8 text-center text-zinc-400">Loading...</td></tr>
              ) : users.map((user) => (
                <tr key={user.id} className="border-b hover:bg-zinc-50">
                  <td className="p-4 font-medium">{user.name}</td>
                  <td className="p-4 text-zinc-600">{user.email}</td>
                  <td className="p-4"><Badge variant="info">{user.role}</Badge></td>
                  <td className="p-4">{user.team}</td>
                  <td className="p-4">
                    <Badge variant={user.active ? 'success' : 'danger'}>
                      {user.active ? 'Active' : 'Inactive'}
                    </Badge>
                  </td>
                  <td className="p-4">
                    <div className="flex gap-1">
                      <Button variant="secondary" onClick={() => setEditUser(user)} className="text-xs px-2 py-1">Edit</Button>
                      {user.active && (
                        <Button variant="secondary" onClick={() => handleDeactivate(user.id)} className="text-xs px-2 py-1 text-red-600">
                          Deactivate
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <CreateUserModal open={showCreate} onClose={() => setShowCreate(false)} onCreated={fetchUsers} />
      <EditUserModal user={editUser} onClose={() => setEditUser(null)} onUpdated={fetchUsers} />
    </div>
  );
}

function CreateUserModal({ open, onClose, onCreated }: any) {
  const [form, setForm] = useState({ email: '', password: '', name: '', role: 'AGENT', team: 'HH' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await api.createUser(form);
      onCreated();
      onClose();
      setForm({ email: '', password: '', name: '', role: 'AGENT', team: 'HH' });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Create User">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>}
        <div>
          <label className="block text-sm font-medium mb-1">Name</label>
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Email</label>
          <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Password</label>
          <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Role</label>
            <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </Select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Team</label>
            <Select value={form.team} onChange={(e) => setForm({ ...form, team: e.target.value })}>
              {TEAMS.map((t) => <option key={t} value={t}>{t}</option>)}
            </Select>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={loading}>{loading ? 'Creating...' : 'Create User'}</Button>
        </div>
      </form>
    </Modal>
  );
}

function EditUserModal({ user, onClose, onUpdated }: any) {
  const [form, setForm] = useState({ name: '', role: '', team: '', active: true });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      setForm({ name: user.name, role: user.role, team: user.team, active: user.active });
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.updateUser(user.id, form);
      onUpdated();
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  return (
    <Modal open={!!user} onClose={onClose} title={`Edit ${user.name}`}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Name</label>
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Role</label>
            <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </Select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Team</label>
            <Select value={form.team} onChange={(e) => setForm({ ...form, team: e.target.value })}>
              {TEAMS.map((t) => <option key={t} value={t}>{t}</option>)}
            </Select>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
          <label className="text-sm">Active</label>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={loading}>{loading ? 'Saving...' : 'Save Changes'}</Button>
        </div>
      </form>
    </Modal>
  );
}
