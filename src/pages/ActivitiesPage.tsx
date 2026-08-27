import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Card, Button, Input, Select, Textarea, Modal, Badge, Spinner, EmptyState,
} from '@/components/ui';
import {
  ACTIVITY_STATUS_LABELS, ACTIVITY_STATUS_COLORS,
  type Activity, type Project, type Profile, type WorkOrder,
  type ActivityStatus,
} from '@/types';
import { formatDateTime, formatDuration } from '@/lib/utils';
import { Activity as ActivityIcon, Plus, Pencil, Trash2, Search, Play, Square, MapPin, Clock, ChevronRight } from 'lucide-react';

const STATUS_OPTIONS = Object.entries(ACTIVITY_STATUS_LABELS).map(([v, l]) => ({ value: v, label: l }));

export function ActivitiesPage({ onOpenActivity }: { onOpenActivity?: (id: string) => void }) {
  const [loading, setLoading] = useState(true);
  const [activities, setActivities] = useState<(Activity & { project: Project | null; responsible: Profile | null; work_order: WorkOrder | null })[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [responsibles, setResponsibles] = useState<Profile[]>([]);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Activity | null>(null);
  const [form, setForm] = useState<Partial<Activity>>({});

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('activities')
      .select('*, project:projects(*), responsible:profiles(*), work_order:work_orders(*)')
      .order('created_at', { ascending: false });
    setActivities((data as any[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    (async () => {
      await load();
      const [p, r, wo] = await Promise.all([
        supabase.from('projects').select('*').order('name'),
        supabase.from('profiles').select('*').eq('active', true).order('name'),
        supabase.from('work_orders').select('*').order('created_at', { ascending: false }),
      ]);
      setProjects((p.data as Project[]) ?? []);
      setResponsibles((r.data as Profile[]) ?? []);
      setWorkOrders((wo.data as WorkOrder[]) ?? []);
    })();
  }, []);

  const openNew = async () => {
    setEditing(null);
    const { count } = await supabase
      .from('activities')
      .select('*', { count: 'exact', head: true });
    const next = (count ?? 0) + 1;
    setForm({ status: 'planejada', number: `ATV-${String(next).padStart(4, '0')}` });
    setModalOpen(true);
  };

  const openEdit = (a: Activity) => {
    setEditing(a);
    setForm(a);
    setModalOpen(true);
  };

  const save = async () => {
    if (editing) {
      await supabase.from('activities').update(form).eq('id', editing.id);
    } else {
      await supabase.from('activities').insert(form);
    }
    setModalOpen(false);
    await load();
  };

  const remove = async (id: string) => {
    if (!confirm('Excluir esta atividade?')) return;
    await supabase.from('activities').delete().eq('id', id);
    await load();
  };

  const toggleStart = async (a: Activity) => {
    if (a.status === 'em_andamento') {
      await supabase.from('activities').update({
        status: 'concluida',
        finished_at: new Date().toISOString(),
      }).eq('id', a.id);
    } else if (a.status === 'planejada') {
      await supabase.from('activities').update({
        status: 'em_andamento',
        started_at: new Date().toISOString(),
      }).eq('id', a.id);
    }
    await load();
  };

  const filtered = activities.filter((a) => {
    const matchSearch = !search || a.title.toLowerCase().includes(search.toLowerCase()) || a.number.toLowerCase().includes(search.toLowerCase());
    const matchStatus = !statusFilter || a.status === statusFilter;
    return matchSearch && matchStatus;
  });

  if (loading) return <Spinner />;

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Atividades</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Controle de atividades de campo</p>
        </div>
        <Button onClick={openNew}><Plus size={18} /> Nova atividade</Button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative min-w-0 flex-1">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por título ou número..."
            className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500 dark:focus:border-slate-600 dark:focus:ring-slate-700/40"
          />
        </div>
        <Select value={statusFilter} onChange={setStatusFilter} options={STATUS_OPTIONS} placeholder="Todos os status" className="sm:w-56" />
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={<ActivityIcon size={48} />} title="Nenhuma atividade encontrada" description="Crie a primeira atividade" />
      ) : (
        <div className="space-y-3">
          {filtered.map((a) => (
            <Card key={a.id} className={`p-4 ${onOpenActivity ? 'cursor-pointer hover:border-slate-300 hover:shadow-md transition-all' : ''}`} onClick={onOpenActivity ? () => onOpenActivity(a.id) : undefined}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold text-slate-400 dark:text-slate-500">{a.number}</span>
                    <Badge className={ACTIVITY_STATUS_COLORS[a.status]}>{ACTIVITY_STATUS_LABELS[a.status]}</Badge>
                  </div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{a.title}</h3>
                  <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                    <span>Obra: {a.project?.name ?? '-'}</span>
                    <span>OS: {a.work_order?.number ?? '-'}</span>
                    <span>Resp.: {a.responsible?.name ?? '-'}</span>
                    {a.started_at && (
                      <span className="flex items-center gap-1"><Clock size={12} /> {formatDuration(a.started_at, a.finished_at)}</span>
                    )}
                  </div>
                </div>
                <div className="flex flex-shrink-0 items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  {(a.status === 'planejada' || a.status === 'em_andamento') && (
                    <Button
                      size="sm"
                      variant={a.status === 'planejada' ? 'success' : 'primary'}
                      onClick={() => toggleStart(a)}
                    >
                      {a.status === 'planejada' ? <><Play size={14} /> Iniciar</> : <><Square size={14} /> Finalizar</>}
                    </Button>
                  )}
                  <Button variant="secondary" size="sm" onClick={() => onOpenActivity?.(a.id)}>
                    Abrir <ChevronRight size={14} />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => openEdit(a)}><Pencil size={14} /></Button>
                  <Button variant="ghost" size="sm" onClick={() => remove(a.id)} className="text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-900/20"><Trash2 size={14} /></Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Editar atividade' : 'Nova atividade'} size="lg">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Número" value={form.number ?? ''} onChange={(v) => setForm({ ...form, number: v })} required disabled={!editing} />
          <Select
            label="Ordem de serviço"
            value={form.work_order_id ?? ''}
            onChange={(v) => {
              const wo = workOrders.find((w) => w.id === v);
              setForm({ ...form, work_order_id: v, project_id: wo?.project_id ?? form.project_id });
            }}
            options={workOrders.map((w) => ({ value: w.id, label: `${w.number} - ${w.title}` }))}
            placeholder="Selecione..."
            required
          />
          <Input label="Título" value={form.title ?? ''} onChange={(v) => setForm({ ...form, title: v })} required className="sm:col-span-2" />
          <Textarea label="Descrição" value={form.description ?? ''} onChange={(v) => setForm({ ...form, description: v })} className="sm:col-span-2" />
          <Select
            label="Obra"
            value={form.project_id ?? ''}
            onChange={(v) => setForm({ ...form, project_id: v })}
            options={projects.map((p) => ({ value: p.id, label: `${p.code} - ${p.name}` }))}
            placeholder="Selecione..."
            required
          />
          <Select
            label="Responsável"
            value={form.responsible_id ?? ''}
            onChange={(v) => setForm({ ...form, responsible_id: v || null })}
            options={responsibles.map((r) => ({ value: r.id, label: r.name }))}
            placeholder="Selecione..."
          />
          <Input label="Data planejada" type="date" value={form.planned_date ?? ''} onChange={(v) => setForm({ ...form, planned_date: v || null })} />
          <Input label="Horário planejado" type="time" value={form.planned_time ?? ''} onChange={(v) => setForm({ ...form, planned_time: v || null })} />
          <Input label="Local" value={form.location ?? ''} onChange={(v) => setForm({ ...form, location: v })} className="sm:col-span-2" />
          <Select label="Status" value={form.status ?? 'planejada'} onChange={(v) => setForm({ ...form, status: v as ActivityStatus })} options={STATUS_OPTIONS} />
          <Textarea label="Observações" value={form.observations ?? ''} onChange={(v) => setForm({ ...form, observations: v })} className="sm:col-span-2" />
          <Textarea label="Problemas" value={form.problems ?? ''} onChange={(v) => setForm({ ...form, problems: v })} className="sm:col-span-2" />
          <Textarea label="Descrição do serviço" value={form.service_description ?? ''} onChange={(v) => setForm({ ...form, service_description: v })} className="sm:col-span-2" />
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancelar</Button>
          <Button onClick={save}>{editing ? 'Salvar' : 'Criar atividade'}</Button>
        </div>
      </Modal>
    </div>
  );
}
