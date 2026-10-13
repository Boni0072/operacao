import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { AlertTriangle, Calendar, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Clock, Clock3, Expand, Filter, HardHat, Image as ImageIcon, MapPin, Minimize, StickyNote, User, Users, Wrench, X, ArrowRight } from 'lucide-react';
import { Badge, Button, Spinner } from '@/components/ui';
import type { Profile, ActivityStatus } from '@/types';
import { formatCurrency, formatDateTime, formatDuration, initials } from '@/lib/utils';

type ViewMode = 'day' | 'week';

type ScheduleItem = {
  id: string;
  title: string;
  number: string;
  planned_date: string | null;
  planned_time: string | null;
  location: string | null;
  status: ActivityStatus;
  responsible_id: string | null;
  description: string | null;
  service_description: string | null;
  observations: string | null;
  problems: string | null;
  started_at: string | null;
  finished_at: string | null;
  project: { id: string; code: string; name: string; city: string | null; state: string | null } | null;
  responsible: { name: string } | null;
};

type ActivityRecordType = 'displacement' | 'evidence' | 'fuel' | 'meal' | 'material' | 'expense';

interface ActivityRecord {
  id: string;
  type: ActivityRecordType;
  description: string;
  amount: number;
  receipt_path: string | null;
  created_at: string | null;
}

const HOUR_START = 7;
const HOUR_END = 20;
const HOURS = Array.from({ length: HOUR_END - HOUR_START + 1 }, (_, index) => HOUR_START + index);
const ROW_HEIGHT = 84; // matches min-h-[84px] on hour cells
const STATUS_COLORS: Record<ActivityStatus, string> = {
  planejada: 'border-sky-400 bg-sky-50 text-sky-900 dark:bg-sky-950/50 dark:text-sky-100',
  em_andamento: 'border-amber-400 bg-amber-50 text-amber-900 dark:bg-amber-950/50 dark:text-amber-100',
  concluida: 'border-emerald-400 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-100',
  cancelada: 'border-rose-400 bg-rose-50 text-rose-900 dark:bg-rose-950/50 dark:text-rose-100',
};

const STATUS_LABELS: Record<ActivityStatus, string> = {
  planejada: 'Planejada',
  em_andamento: 'Em andamento',
  concluida: 'Concluída',
  cancelada: 'Cancelada',
};

const RECORD_TYPE_LABELS: Record<ActivityRecordType, string> = {
  displacement: 'Deslocamento',
  evidence: 'Evidência',
  fuel: 'Combustível',
  meal: 'Refeição',
  material: 'Material',
  expense: 'Despesa',
};

const RECORD_TYPE_COLORS: Record<ActivityRecordType, string> = {
  displacement: 'bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300',
  evidence: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300',
  fuel: 'bg-violet-50 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300',
  meal: 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300',
  material: 'bg-orange-50 text-orange-700 dark:bg-orange-950/50 dark:text-orange-300',
  expense: 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300',
};

const RECORD_TYPE_ORDER: ActivityRecordType[] = ['displacement', 'evidence', 'fuel', 'meal', 'material', 'expense'];

function dateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}


function startOfWeek(date: Date): Date {
  const result = new Date(date);
  const day = result.getDay();
  result.setDate(result.getDate() - (day === 0 ? 6 : day - 1));
  return result;
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function formatRange(date: Date, mode: ViewMode): string {
  if (mode === 'day') {
    return date.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }

  const weekStart = startOfWeek(date);
  const weekEnd = addDays(weekStart, 6);
  const start = weekStart.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
  const end = weekEnd.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
  return `${start} – ${end}`;
}

function formatDay(date: Date): string {
  return date.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
}

function formatTime(time: string | null): string {
  if (!time) return 'Dia inteiro';
  return time.slice(0, 5);
}

function formatDateBR(date: string | null): string {
  if (!date) return 'Não informada';
  const [year, month, day] = date.split('T')[0].split('-');
  return `${day}/${month}/${year}`;
}

function receiptUrl(path: string | null): string | null {
  if (!path) return null;
  return supabase.storage.from('receipts').getPublicUrl(path).data.publicUrl;
}

function DetailSection({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider opacity-60">
        {icon} {title}
      </p>
      <p className="whitespace-pre-wrap rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-relaxed dark:border-slate-700 dark:bg-slate-800/50">
        {children}
      </p>
    </div>
  );
}

function PhotoCard({ record, showType = false }: { record: ActivityRecord; showType?: boolean }) {
  const url = receiptUrl(record.receipt_path);
  if (!url) return null;
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800/50">
      {showType && (
        <div className="px-2.5 pt-2">
          <Badge className={RECORD_TYPE_COLORS[record.type]}>{RECORD_TYPE_LABELS[record.type]}</Badge>
        </div>
      )}
      <p className={`line-clamp-2 px-2.5 text-xs font-medium leading-snug text-slate-700 dark:text-slate-200 ${showType ? 'pt-1.5' : 'pt-2'}`}>
        {record.description || 'Sem descrição'}
      </p>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="group relative mt-2 block aspect-[4/3] w-full overflow-hidden bg-slate-100 dark:bg-slate-800"
        title="Ver foto em tamanho real"
      >
        <img
          src={url}
          alt={record.description || 'Foto'}
          loading="lazy"
          className="h-full w-full object-cover transition group-hover:scale-105"
        />
        <span className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition group-hover:opacity-100">
          <ImageIcon size={16} className="text-white" />
        </span>
      </a>
      <div className="flex items-center justify-between gap-1.5 px-2.5 py-1.5 text-[10px] text-slate-500 dark:text-slate-400">
        <span className="flex min-w-0 items-center gap-1 truncate">
          <Clock3 size={10} className="shrink-0" />
          <span className="truncate">{formatDateTime(record.created_at)}</span>
        </span>
        {record.amount > 0 && (
          <span className="shrink-0 font-medium text-slate-700 dark:text-slate-300">{formatCurrency(record.amount)}</span>
        )}
      </div>
    </div>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 text-slate-400 dark:text-slate-500">{icon}</span>
      <div className="min-w-0">
        <p className="text-xs text-slate-400 dark:text-slate-500">{label}</p>
        <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">{value}</p>
      </div>
    </div>
  );
}

export function SchedulePage({ onOpenActivity }: { onOpenActivity?: (id: string) => void }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activities, setActivities] = useState<ScheduleItem[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedProfileIds, setSelectedProfileIds] = useState<string[]>([]);
  const [date, setDate] = useState(() => new Date());
  const [mode, setMode] = useState<ViewMode>('week');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ScheduleItem | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activityRecords, setActivityRecords] = useState<ActivityRecord[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [recordsError, setRecordsError] = useState('');
  const currentTimeLineRef = useRef<HTMLDivElement>(null);
  const scheduleRef = useRef<HTMLDivElement>(null);
  const [now, setNow] = useState(() => new Date());
  const headerRef = useRef<HTMLDivElement>(null);
  const [headerOffset, setHeaderOffset] = useState(0);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      const [activityResult, profileResult] = await Promise.all([
        supabase
          .from('activities')
          .select('id, title, number, planned_date, planned_time, location, status, responsible_id, description, service_description, observations, problems, started_at, finished_at, project:projects(code, name, city, state), responsible:profiles!activities_responsible_id_fkey(name)')
          .not('planned_date', 'is', null)
          .order('planned_date')
          .order('planned_time'),
        supabase.from('profiles').select('*').eq('active', true).order('name'),
      ]);

      if (activityResult.error || profileResult.error) {
        setError('Não foi possível carregar a agenda agora.');
      } else {
        setActivities((activityResult.data as unknown as ScheduleItem[]) ?? []);
        setProfiles((profileResult.data as Profile[]) ?? []);
      }
      setLoading(false);
    };

    void load();
  }, []);

  // Busca os registros cadastrados para a atividade selecionada.
  useEffect(() => {
    if (!selectedItem) {
      setActivityRecords([]);
      setRecordsError('');
      return;
    }

    const loadRecords = async () => {
      setRecordsLoading(true);
      setRecordsError('');
      const { data, error } = await supabase
        .from('activity_records')
        .select('id, type, description, amount, receipt_path, created_at')
        .eq('activity_id', selectedItem.id)
        .order('created_at', { ascending: true });
      if (error) {
        setRecordsError(error.message);
      } else {
        setActivityRecords(data as ActivityRecord[]);
      }
      setRecordsLoading(false);
    };

    void loadRecords();
  }, [selectedItem]);

  // Evidências: registros do tipo "evidence" com foto.
  const evidenceRecords = useMemo(
    () => activityRecords.filter((record) => record.type === 'evidence' && record.receipt_path),
    [activityRecords],
  );
  // Fotos: comprovantes de outros tipos (combustível, refeição, material, despesa).
  const photoRecords = useMemo(
    () => activityRecords.filter((record) => record.type !== 'evidence' && record.receipt_path),
    [activityRecords],
  );
  const otherRecords = useMemo(
    () => activityRecords.filter((record) => !record.receipt_path),
    [activityRecords],
  );

  // Registros sem foto agrupados por tipo (Deslocamento, Combustível, ...).
  const recordsByType = useMemo(() => {
    const groups = new Map<ActivityRecordType, ActivityRecord[]>();
    for (const record of otherRecords) {
      const list = groups.get(record.type);
      if (list) list.push(record);
      else groups.set(record.type, [record]);
    }
    return RECORD_TYPE_ORDER
      .map((type) => ({ type, records: groups.get(type) ?? [] }))
      .filter((group) => group.records.length > 0);
  }, [otherRecords]);

  const dates = useMemo(() => {
    if (mode === 'day') return [new Date(date)];
    const weekStart = startOfWeek(date);
    return Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
  }, [date, mode]);

  const visibleActivities = useMemo(() => {
    if (selectedProfileIds.length === 0) return activities;
    return activities.filter((item) => item.responsible_id && selectedProfileIds.includes(item.responsible_id));
  }, [activities, selectedProfileIds]);

  const activitiesByDate = useMemo(() => {
    return dates.reduce<Record<string, ScheduleItem[]>>((result, currentDate) => {
      result[dateKey(currentDate)] = visibleActivities.filter((item) => item.planned_date === dateKey(currentDate));
      return result;
    }, {});
  }, [dates, visibleActivities]);

  const currentTimeLine = useMemo(() => {
    const todayVisible = dates.some((d) => dateKey(d) === dateKey(now));
    if (!todayVisible) return null;

    const timeInHours = now.getHours() + now.getMinutes() / 60;
    if (timeInHours < HOUR_START || timeInHours > HOUR_END) return null;

    return {
      offsetPx: headerOffset + (timeInHours - HOUR_START) * ROW_HEIGHT,
      label: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
    };
  }, [dates, now, headerOffset]);

  const goToPrevious = () => setDate((current) => addDays(current, mode === 'day' ? -1 : -7));
  const goToNext = () => setDate((current) => addDays(current, mode === 'day' ? 1 : 7));
  const goToToday = () => setDate(new Date());

  const toggleProfile = (profileId: string) => {
    setSelectedProfileIds((current) => current.includes(profileId) ? current.filter((id) => id !== profileId) : [...current, profileId]);
  };

  const toggleFullscreen = async () => {
    if (!document.fullscreenElement) {
      await scheduleRef.current?.requestFullscreen();
    } else {
      await document.exitFullscreen();
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => setIsFullscreen(document.fullscreenElement === scheduleRef.current);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  useLayoutEffect(() => {
    if (headerRef.current) {
      setHeaderOffset(headerRef.current.offsetHeight);
    } else {
      setHeaderOffset(0);
    }
  }, [dates]);

  useEffect(() => {
    // Sincroniza a linha do tempo com o relógio do computador: agenda a primeira
    // atualização para o próximo minuto exato e, depois, renova a cada 60s.
    let interval: ReturnType<typeof setInterval> | null = null;
    let timeout: ReturnType<typeof setTimeout> | null = null;

    const tick = () => {
      setNow(new Date());
      interval = setInterval(() => setNow(new Date()), 60000);
    };

    const nowDate = new Date();
    const msUntilNextMinute = (60 - nowDate.getSeconds()) * 1000 - nowDate.getMilliseconds();
    timeout = setTimeout(tick, msUntilNextMinute);

    return () => {
      if (timeout) clearTimeout(timeout);
      if (interval) clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    const element = currentTimeLineRef.current;
    if (!element) return;

    requestAnimationFrame(() => {
      element.scrollIntoView({
        block: 'center',
        inline: 'nearest',
        behavior: 'smooth',
      });
    });
  }, [date, mode, dates, loading]);

  if (loading) return <Spinner />;

  return (
    <div ref={scheduleRef} className={`page-container ${isFullscreen ? 'min-h-screen overflow-auto bg-slate-50 p-4 dark:bg-slate-950 sm:p-6 lg:p-8' : ''}`}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-amber-600 dark:text-amber-400">
            <CalendarDays size={18} />
            <span className="text-xs font-bold uppercase tracking-[0.18em]">Planejamento de campo</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Agenda</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Acompanhe a agenda dos colaboradores em um só lugar.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={goToToday} className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800">Hoje</button>
          <div className="flex rounded-lg border border-slate-200 bg-white p-1 dark:border-slate-700 dark:bg-slate-900">
            <button onClick={() => setMode('day')} className={`rounded-md px-3 py-1.5 text-sm font-semibold transition ${mode === 'day' ? 'bg-slate-900 text-white dark:bg-amber-500 dark:text-amber-950' : 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'}`}>Dia</button>
            <button onClick={() => setMode('week')} className={`rounded-md px-3 py-1.5 text-sm font-semibold transition ${mode === 'week' ? 'bg-slate-900 text-white dark:bg-amber-500 dark:text-amber-950' : 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'}`}>Semana</button>
          </div>
          <button onClick={() => setFiltersOpen((current) => !current)} className={`inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 text-sm font-semibold transition ${filtersOpen || selectedProfileIds.length > 0 ? 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200'}`}>
            <Filter size={16} /> Colaboradores{selectedProfileIds.length > 0 ? ` (${selectedProfileIds.length})` : ''}
          </button>
          <button
            type="button"
            onClick={() => void toggleFullscreen()}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            title={isFullscreen ? 'Sair da tela cheia' : 'Expandir agenda'}
            aria-label={isFullscreen ? 'Sair da tela cheia' : 'Expandir agenda'}
          >
            {isFullscreen ? <Minimize size={16} /> : <Expand size={16} />}
          </button>
        </div>
      </div>

      {filtersOpen && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">Visualizar agenda de</p>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Selecione um ou mais colaboradores.</p>
            </div>
            {selectedProfileIds.length > 0 && <button onClick={() => setSelectedProfileIds([])} className="text-xs font-semibold text-amber-700 hover:underline dark:text-amber-400">Limpar seleção</button>}
          </div>
          <div className="flex flex-wrap gap-2">
            {profiles.map((profile) => {
              const selected = selectedProfileIds.includes(profile.id);
              return <button key={profile.id} onClick={() => toggleProfile(profile.id)} className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium transition ${selected ? 'border-slate-900 bg-slate-900 text-white dark:border-amber-500 dark:bg-amber-500 dark:text-amber-950' : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'}`}><span className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold ${selected ? 'bg-white/20' : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-200'}`}>{initials(profile.name)}</span>{profile.name}</button>;
            })}
            {profiles.length === 0 && <span className="text-sm text-slate-500 dark:text-slate-400">Nenhum colaborador ativo encontrado.</span>}
          </div>
        </div>
      )}

      {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">{error}</div> : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800 sm:px-6">
            <div className="flex items-center gap-3"><button onClick={goToPrevious} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"><ChevronLeft size={19} /></button><button onClick={goToNext} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"><ChevronRight size={19} /></button><h2 className="text-sm font-bold capitalize text-slate-900 dark:text-white sm:text-base">{formatRange(date, mode)}</h2></div>
            <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400"><div className="hidden items-center gap-3 md:flex"><span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-sky-400" />Planejada</span><span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-400" />Em andamento</span><span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-400" />Concluída</span></div><span className="hidden items-center gap-2 sm:flex"><Users size={15} /> {selectedProfileIds.length ? `${selectedProfileIds.length} selecionado(s)` : 'Todos os colaboradores'}</span></div>
          </div>

          <div className="max-h-[calc(100vh-320px)] overflow-y-auto">
            <div className={`relative grid min-w-[${mode === 'day' ? '640px' : '980px'}]`} style={{ gridTemplateColumns: `68px repeat(${dates.length}, minmax(150px, 1fr))` }}>
            <div className="border-b border-r border-slate-100 bg-slate-50/70 dark:border-slate-800 dark:bg-slate-950/30" />
            {dates.map((currentDate) => {
              const isToday = dateKey(currentDate) === dateKey(new Date());
              return <div key={dateKey(currentDate)} ref={isToday ? headerRef : undefined} className={`border-b border-r border-slate-100 px-3 py-3 text-center last:border-r-0 dark:border-slate-800 ${isToday ? 'bg-amber-50/60 dark:bg-amber-950/20' : 'bg-slate-50/70 dark:bg-slate-950/30'}`}><p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">{formatDay(currentDate)}</p><p className={`mx-auto mt-1 flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${isToday ? 'bg-amber-500 text-white' : 'text-slate-700 dark:text-slate-200'}`}>{currentDate.getDate()}</p></div>;
            })}

            {HOURS.map((hour) => <div key={hour} className="contents"><div className="border-b border-r border-slate-100 px-2 pt-2 text-right text-[11px] font-medium text-slate-400 dark:border-slate-800 dark:text-slate-500">{String(hour).padStart(2, '0')}:00</div>{dates.map((currentDate) => { const items = activitiesByDate[dateKey(currentDate)]?.filter((item) => item.planned_time ? Number(item.planned_time.slice(0, 2)) === hour : hour === HOUR_START) ?? []; return <div key={`${dateKey(currentDate)}-${hour}`} className="min-h-[84px] border-b border-r border-slate-100 p-1.5 last:border-r-0 dark:border-slate-800">{items.map((item) => <div key={item.id} title={`Obra: ${item.title}\nEndereço: ${item.location || 'Não informado'}\nStatus: ${STATUS_LABELS[item.status]}`} aria-label={`Obra ${item.title}. Endereço: ${item.location || 'não informado'}. Status: ${STATUS_LABELS[item.status]}`} tabIndex={0} onClick={() => setSelectedItem(item)} className={`group mb-1 cursor-pointer rounded-lg border-l-4 p-2 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-amber-400 ${STATUS_COLORS[item.status]}`}><div className="flex items-start justify-between gap-1"><p className="line-clamp-2 text-xs font-bold leading-4">{item.title}</p><span className="shrink-0 text-[10px] font-semibold opacity-70">{item.number}</span></div><p className="mt-1 flex items-center gap-1 text-[10px] font-medium opacity-75"><Clock3 size={11} /> {formatTime(item.planned_time)}</p>{item.responsible?.name && <p className="mt-1 flex items-center gap-1 truncate text-[10px] font-semibold opacity-80"><Users size={11} className="shrink-0" /> {item.responsible.name}</p>}</div>)}</div>; })}</div>)}
            {currentTimeLine && (
              <div
                ref={currentTimeLineRef}
                className="pointer-events-none absolute z-10"
                style={{ top: `${currentTimeLine.offsetPx}px`, left: 68, right: 0 }}
              >
                <span className="absolute -top-6 left-0 -translate-x-1/2 rounded bg-red-500 px-1.5 py-0.5 text-[9px] font-bold text-white whitespace-nowrap">
                  {currentTimeLine.label}
                </span>
                <div className="absolute top-0 left-0 h-0.5 w-full bg-red-500 shadow-md shadow-red-500/50"></div>
                <div className="absolute top-0 left-0 h-3 w-3 -translate-x-1/2 rounded-full bg-red-500 ring-2 ring-white dark:ring-slate-900"></div>
              </div>
            )}
            </div>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-2 border-t border-slate-100 px-4 py-3 dark:border-slate-800"><p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Legenda:</p>{(Object.keys(STATUS_LABELS) as ActivityStatus[]).map((status) => <span key={status} className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400"><span className={`h-2 w-2 rounded-full ${status === 'planejada' ? 'bg-sky-400' : status === 'em_andamento' ? 'bg-amber-400' : status === 'concluida' ? 'bg-emerald-400' : 'bg-rose-400'}`} />{STATUS_LABELS[status]}</span>)}</div>
        </div>
      )}
      {selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setSelectedItem(null)} />
          <div className={`relative w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl border-l-4 bg-white p-6 shadow-2xl dark:bg-slate-900 ${STATUS_COLORS[selectedItem.status]}`}>
            <button onClick={() => setSelectedItem(null)} className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-200" aria-label="Fechar">
              <X size={18} />
            </button>
            {/* Cabeçalho (padrão das atividades) */}
            <div className="flex items-start justify-between gap-3 pr-8">
              <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-bold tracking-wide text-slate-600 dark:bg-slate-800 dark:text-slate-300">{selectedItem.number}</span>
              <Badge className={STATUS_COLORS[selectedItem.status]}>{STATUS_LABELS[selectedItem.status]}</Badge>
            </div>
            <h3 className="mt-3 text-lg font-bold leading-7">{selectedItem.title}</h3>
            {selectedItem.description && (
              <p className="mt-1 text-sm opacity-70">{selectedItem.description}</p>
            )}

            {/* Informações */}
            <div className="mt-5 grid grid-cols-1 divide-y divide-slate-100 sm:grid-cols-2 sm:divide-y-0 sm:divide-x dark:divide-slate-800">
              <div className="space-y-3 py-4 sm:pr-5">
                <InfoRow icon={<HardHat size={16} />} label="Obra" value={selectedItem.project?.name ?? '-'} />
                <InfoRow icon={<Calendar size={16} />} label="Data" value={formatDateBR(selectedItem.planned_date)} />
                <InfoRow icon={<Clock3 size={16} />} label="Horário" value={formatTime(selectedItem.planned_time)} />
                <InfoRow icon={<User size={16} />} label="Responsável" value={selectedItem.responsible?.name ?? '-'} />
                <InfoRow icon={<MapPin size={16} />} label="Endereço" value={selectedItem.location ?? '-'} />
              </div>
              <div className="space-y-3 py-4 sm:pl-5">
                <InfoRow icon={<Clock size={16} />} label="Iniciada em" value={formatDateTime(selectedItem.started_at)} />
                <InfoRow icon={<CheckCircle2 size={16} />} label="Finalizada em" value={formatDateTime(selectedItem.finished_at)} />
                <InfoRow icon={<Clock size={16} />} label="Duração" value={formatDuration(selectedItem.started_at, selectedItem.finished_at)} />
              </div>
            </div>

            {/* Detalhamento */}
            <div className="mt-5 space-y-4">
              {selectedItem.service_description && (
                <DetailSection icon={<Wrench size={14} />} title="Descrição do serviço">
                  {selectedItem.service_description}
                </DetailSection>
              )}
              {selectedItem.observations && (
                <DetailSection icon={<StickyNote size={14} />} title="Observações">
                  {selectedItem.observations}
                </DetailSection>
              )}
              {selectedItem.problems && (
                <DetailSection icon={<AlertTriangle size={14} />} title="Problemas">
                  {selectedItem.problems}
                </DetailSection>
              )}
            </div>

        {/* Evidências */}
        {(evidenceRecords.length > 0 || recordsLoading || recordsError) && (
          <div className="mt-5 border-t border-slate-100 pt-5 dark:border-slate-800">
            <div className="mb-3 flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Evidências</h4>
              {!recordsLoading && !recordsError && (
                <span className="text-xs text-slate-500">{evidenceRecords.length} {evidenceRecords.length === 1 ? 'evidência' : 'evidências'}</span>
              )}
            </div>
            {recordsLoading ? (
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <Spinner />
                Carregando evidências...
              </div>
            ) : recordsError ? (
              <p className="text-sm text-rose-600 dark:text-rose-400">{recordsError}</p>
            ) : evidenceRecords.length === 0 ? (
              <p className="text-sm text-slate-400">Nenhuma evidência cadastrada.</p>
            ) : (
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4">
                {evidenceRecords.map((record) => (
                  <PhotoCard key={record.id} record={record} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Refeição — comprovantes com foto (tipos diferentes de evidência) */}
        {!recordsLoading && !recordsError && photoRecords.length > 0 && (
          <div className="mt-5 border-t border-slate-100 pt-5 dark:border-slate-800">
            <div className="mb-3 flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Refeição</h4>
              <span className="text-xs text-slate-500">{photoRecords.length} {photoRecords.length === 1 ? 'registro' : 'registros'}</span>
            </div>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4">
              {photoRecords.map((record) => (
                <PhotoCard key={record.id} record={record} showType />
              ))}
            </div>
          </div>
        )}

        {/* Demais registros (sem foto) — separados por tipo */}
        {!recordsLoading && !recordsError && otherRecords.length > 0 && (
          <div className="mt-5 border-t border-slate-100 pt-5 dark:border-slate-800">
            <div className="mb-3 flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Registros</h4>
              <span className="text-xs text-slate-500">{otherRecords.length} {otherRecords.length === 1 ? 'registro' : 'registros'}</span>
            </div>
            <div className="space-y-4">
              {recordsByType.map((group) => (
                <div key={group.type}>
                  <div className="mb-2 flex items-center gap-2">
                    <Badge className={RECORD_TYPE_COLORS[group.type]}>{RECORD_TYPE_LABELS[group.type]}</Badge>
                    <span className="text-[11px] text-slate-400">{group.records.length} {group.records.length === 1 ? 'registro' : 'registros'}</span>
                  </div>
                  <div className="space-y-0">
                    {group.records.map((record) => (
                      <div key={record.id} className="flex flex-wrap items-start gap-3 border-b border-slate-100 pb-2.5 last:border-0 dark:border-slate-800">
                        <span className="min-w-0 flex-1 text-xs text-slate-400">{formatDateTime(record.created_at)}</span>
                        <p className="min-w-0 flex-[2] text-sm text-slate-700 dark:text-slate-300">{record.description || '—'}</p>
                        {record.amount > 0 && <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{formatCurrency(record.amount)}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-5 flex justify-end border-t border-slate-100 pt-4 dark:border-slate-800">
          <Button variant="secondary" size="sm" onClick={() => onOpenActivity?.(selectedItem.id)}>
            Ver atividade completa <ArrowRight size={14} />
          </Button>
        </div>
        </div>
      </div>
      )}
    </div>
  );
}
