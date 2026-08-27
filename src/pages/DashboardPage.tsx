import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, Spinner, Badge } from '@/components/ui';
import {
  PROJECT_STATUS_LABELS,
  PROJECT_STATUS_COLORS,
  ACTIVITY_STATUS_LABELS,
  ACTIVITY_STATUS_COLORS,
  type Project,
  type Activity,
  type WorkOrder,
  WORK_ORDER_STATUS_LABELS,
  WORK_ORDER_STATUS_COLORS,
} from '@/types';
import { HardHat, Activity as ActivityIcon, ClipboardList, CheckCircle2, Clock, TrendingUp, MapPin } from 'lucide-react';

interface Stats {
  projectsActive: number;
  activitiesInProgress: number;
  activitiesCompleted: number;
  activitiesPending: number;
  workOrdersOpen: number;
}

export function DashboardPage({ onOpenActivity }: { onOpenActivity?: (id: string) => void }) {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats>({ projectsActive: 0, activitiesInProgress: 0, activitiesCompleted: 0, activitiesPending: 0, workOrdersOpen: 0 });
  const [recentActivities, setRecentActivities] = useState<(Activity & { project: Project | null })[]>([]);
  const [recentProjects, setRecentProjects] = useState<Project[]>([]);

  useEffect(() => {
    (async () => {
      const [p, a, wo] = await Promise.all([
        supabase.from('projects').select('*', { count: 'exact', head: false }),
        supabase.from('activities').select('*, project:projects(*)').order('created_at', { ascending: false }).limit(5),
        supabase.from('work_orders').select('*', { count: 'exact', head: true }),
      ]);

      const projects = (p.data ?? []) as Project[];
      const activities = (a.data ?? []) as any[];
      const workOrdersCount = wo.count ?? 0;

      setStats({
        projectsActive: projects.filter((x) => x.status === 'em_andamento').length,
        activitiesInProgress: activities.filter((x) => x.status === 'em_andamento').length,
        activitiesCompleted: activities.filter((x) => x.status === 'concluida').length,
        activitiesPending: activities.filter((x) => x.status === 'planejada').length,
        workOrdersOpen: workOrdersCount,
      });
      setRecentActivities(activities);
      setRecentProjects(projects.slice(0, 5));
      setLoading(false);
    })();
  }, []);

  if (loading) return <Spinner />;

  const cards = [
    { label: 'Obras ativas', value: stats.projectsActive, icon: <HardHat size={20} />, color: 'text-blue-600 bg-blue-50 dark:bg-blue-950/40 dark:text-blue-400' },
    { label: 'Atividades em andamento', value: stats.activitiesInProgress, icon: <ActivityIcon size={20} />, color: 'text-amber-600 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-400' },
    { label: 'Atividades concluídas', value: stats.activitiesCompleted, icon: <CheckCircle2 size={20} />, color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-400' },
    { label: 'Atividades pendentes', value: stats.activitiesPending, icon: <Clock size={20} />, color: 'text-slate-600 bg-slate-100 dark:bg-slate-800 dark:text-slate-400' },
    { label: 'Ordens de serviço', value: stats.workOrdersOpen, icon: <ClipboardList size={20} />, color: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 dark:text-indigo-400' },
  ];

  return (
    <div className="page-container">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Visão geral das operações de campo</p>
      </div>

      {/* Stats Cards */}
      <div className="card-grid">
        {cards.map((c) => (
          <Card key={c.label} className="metric-card">
            <div className={`mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg ${c.color}`}>
              {c.icon}
            </div>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{c.value}</p>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{c.label}</p>
          </Card>
        ))}
      </div>

      <div className="grid min-w-0 gap-6 lg:grid-cols-2">
        {/* Recent Activities */}
        <Card className="content-card">
          <div className="mb-4 flex items-center gap-2">
            <ActivityIcon size={18} className="text-slate-400 dark:text-slate-500" />
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">Atividades recentes</h2>
          </div>
          {recentActivities.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400 dark:text-slate-500">Nenhuma atividade registrada</p>
          ) : (
            <div className="space-y-3">
              {recentActivities.map((act) => (
                <button
                  key={act.id}
                  onClick={() => onOpenActivity?.(act.id)}
                  className="flex w-full items-center justify-between rounded-lg border border-slate-100 p-3 text-left transition-colors hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">{act.title}</p>
                    <p className="truncate text-xs text-slate-400 dark:text-slate-500">{act.project?.name ?? '-'}</p>
                  </div>
                  <Badge className={ACTIVITY_STATUS_COLORS[act.status]}>
                    {ACTIVITY_STATUS_LABELS[act.status]}
                  </Badge>
                </button>
              ))}
            </div>
          )}
        </Card>

        {/* Recent Projects */}
        <Card className="content-card">
          <div className="mb-4 flex items-center gap-2">
            <HardHat size={18} className="text-slate-400 dark:text-slate-500" />
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">Obras recentes</h2>
          </div>
          {recentProjects.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400 dark:text-slate-500">Nenhuma obra cadastrada</p>
          ) : (
            <div className="space-y-3">
              {recentProjects.map((proj) => (
                <div key={proj.id} className="flex items-center justify-between rounded-lg border border-slate-100 p-3 dark:border-slate-800">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">{proj.code} - {proj.name}</p>
                    <p className="flex items-center gap-1 truncate text-xs text-slate-400 dark:text-slate-500">
                      <MapPin size={12} />
                      {proj.city ?? '-'}, {proj.state ?? '-'}
                    </p>
                  </div>
                  <Badge className={PROJECT_STATUS_COLORS[proj.status]}>
                    {PROJECT_STATUS_LABELS[proj.status]}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Placeholder for charts - Phase 7 */}
      <Card className="content-card">
        <div className="mb-4 flex items-center gap-2">
          <TrendingUp size={18} className="text-slate-400 dark:text-slate-500" />
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">Análises</h2>
        </div>
        <div className="rounded-lg bg-slate-50 p-8 text-center dark:bg-slate-800/50">
          <p className="text-sm text-slate-400 dark:text-slate-500">Gráficos de custos e despesas disponíveis na Fase 7</p>
        </div>
      </Card>
    </div>
  );
}
