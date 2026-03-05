import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card } from '../components/ui/card';
import { Modal } from '../components/ui/modal';
import { Badge } from '../components/ui/badge';

export function AdminCategoriesPage() {
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editCat, setEditCat] = useState<any>(null);

  const fetch = async () => {
    setLoading(true);
    try {
      setCategories(await api.getCategories());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetch(); }, []);

  const handleDeactivate = async (id: string) => {
    if (!confirm('Deactivate this category?')) return;
    await api.deleteCategory(id);
    fetch();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Category Management</h1>
        <Button onClick={() => setShowCreate(true)}>+ New Category</Button>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-zinc-50 text-left text-sm font-medium text-zinc-500">
                <th className="p-4">Name</th>
                <th className="p-4">Description</th>
                <th className="p-4">Status</th>
                <th className="p-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={4} className="p-8 text-center text-zinc-400">Loading...</td></tr>
              ) : categories.map((cat) => (
                <tr key={cat.id} className="border-b hover:bg-zinc-50">
                  <td className="p-4 font-medium">{cat.name}</td>
                  <td className="p-4 text-zinc-600">{cat.description || '—'}</td>
                  <td className="p-4">
                    <Badge variant={cat.active ? 'success' : 'danger'}>
                      {cat.active ? 'Active' : 'Inactive'}
                    </Badge>
                  </td>
                  <td className="p-4">
                    <div className="flex gap-1">
                      <Button variant="secondary" onClick={() => setEditCat(cat)} className="text-xs px-2 py-1">Edit</Button>
                      {cat.active && (
                        <Button variant="secondary" onClick={() => handleDeactivate(cat.id)} className="text-xs px-2 py-1 text-red-600">
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

      <CreateCategoryModal open={showCreate} onClose={() => setShowCreate(false)} onCreated={fetch} />
      <EditCategoryModal category={editCat} onClose={() => setEditCat(null)} onUpdated={fetch} />
    </div>
  );
}

function CreateCategoryModal({ open, onClose, onCreated }: any) {
  const [form, setForm] = useState({ name: '', description: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.createCategory(form);
      onCreated();
      onClose();
      setForm({ name: '', description: '' });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Create Category">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Name</label>
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Description</label>
          <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={loading}>{loading ? 'Creating...' : 'Create'}</Button>
        </div>
      </form>
    </Modal>
  );
}

function EditCategoryModal({ category, onClose, onUpdated }: any) {
  const [form, setForm] = useState({ name: '', description: '', active: true });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (category) {
      setForm({ name: category.name, description: category.description || '', active: category.active });
    }
  }, [category]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.updateCategory(category.id, form);
      onUpdated();
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (!category) return null;

  return (
    <Modal open={!!category} onClose={onClose} title={`Edit ${category.name}`}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Name</label>
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Description</label>
          <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
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
