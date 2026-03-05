import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Select } from '../components/ui/select';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export function DashboardPage() {
  const [kpis, setKpis] = useState<any>(null);
  const [team, setTeam] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params: Record<string, string> = {};
    if (team) params.team = team;
    setLoading(true);
    api.getDashboard(params)
      .then(setKpis)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [team]);

  if (loading || !kpis) {
    return <div className="text-center py-12 text-zinc-400">Loading dashboard...</div>;
  }

  const statusData = Object.entries(kpis.callsByStatus).map(([name, value]) => ({ name, value }));
  const priorityData = Object.entries(kpis.callsByPriority).map(([name, value]) => ({ name, value }));
  const categoryData = Object.entries(kpis.callsByCategory).map(([name, value]) => ({ name, value }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Mission Control</h1>
        <Select value={team} onChange={(e) => setTeam(e.target.value)} className="w-40">
          <option value="">All Teams</option>
          <option value="HH">HH</option>
          <option value="HO">HO</option>
        </Select>
      </div>

      {/* KPI Tiles */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <KpiTile label="Total Calls" value={kpis.totalCalls} color="text-zinc-900" />
        <KpiTile label="Active" value={kpis.activeCalls} color="text-yellow-600" />
        <KpiTile label="Completed" value={kpis.completedCalls} color="text-green-600" />
        <KpiTile label="Missed" value={kpis.missedCalls} color="text-red-600" />
        <KpiTile label="Avg Duration" value={formatDuration(kpis.avgDuration)} color="text-blue-600" />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>Calls by Hour</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={kpis.callsByHour}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="hour" tickFormatter={(h) => `${h}:00`} />
                <YAxis allowDecimals={false} />
                <Tooltip labelFormatter={(h) => `${h}:00`} />
                <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Calls by Status</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={statusData} cx="50%" cy="50%" outerRadius={100} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {statusData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>Calls by Priority</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={priorityData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" allowDecimals={false} />
                <YAxis type="category" dataKey="name" width={80} />
                <Tooltip />
                <Bar dataKey="value" fill="#f59e0b" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Calls by Category</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={categoryData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label>
                  {categoryData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Top Agents */}
      <Card>
        <CardHeader><CardTitle>Top Agents</CardTitle></CardHeader>
        <CardContent>
          <table className="w-full">
            <thead>
              <tr className="border-b text-left text-sm font-medium text-zinc-500">
                <th className="pb-3">Agent</th>
                <th className="pb-3">Calls Handled</th>
                <th className="pb-3">Avg Duration</th>
              </tr>
            </thead>
            <tbody>
              {kpis.topAgents.map((agent: any) => (
                <tr key={agent.agentId} className="border-b last:border-0">
                  <td className="py-3 font-medium">{agent.agentName}</td>
                  <td className="py-3">{agent.count}</td>
                  <td className="py-3 font-mono text-sm">{formatDuration(agent.avgDuration)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

function KpiTile({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <Card>
      <CardContent className="p-4 text-center">
        <p className="text-sm text-zinc-500">{label}</p>
        <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

function formatDuration(seconds: number): string {
  if (!seconds) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
