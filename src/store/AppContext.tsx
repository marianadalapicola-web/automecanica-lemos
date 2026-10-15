import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { AppData, ISODate, MonthKey } from '../data/types';
import { emptyData } from '../data/defaults';
import { OpError } from '../data/ops';
import { ConflictError, LocalDemoStore, NetworkError, SupabaseStore, pendingQueue, type DataStore, type Snapshot } from './stores';
import { supabase } from './supabaseClient';
import { todayISO } from '../lib/dates';
import { monthOfToday } from '../lib/finance';
import { useToast } from '../components/ui';

export type Mode = 'loading' | 'signed-out' | 'demo' | 'cloud';
export type SyncState = 'idle' | 'saving' | 'saved' | 'error' | 'offline' | 'conflict';

interface Ctx {
  mode: Mode;
  user: { id: string; email: string } | null;
  data: AppData;
  ready: boolean;
  loadError: string | null;
  sync: SyncState;
  syncError: string | null;
  lastSaved: string | null;
  online: boolean;
  today: ISODate;
  month: MonthKey;
  setMonth: (m: MonthKey) => void;
  /** Aplica uma operação confirmada; salva automaticamente. Retorna false se a operação falhou. */
  update: (fn: (d: AppData) => AppData, successMsg?: string) => boolean;
  startDemo: () => void;
  leaveDemo: () => Promise<void>;
  signOut: () => Promise<void>;
  retrySync: () => void;
  resolveConflict: (keep: 'cloud' | 'local') => Promise<void>;
  reload: () => Promise<void>;
  wipeAll: () => Promise<void>;
  deleteAccount: () => Promise<void>;
}

const AppCtx = createContext<Ctx | null>(null);
const DEMO_FLAG = 'glossy-money:mode';

export function AppProvider({ children }: { children: ReactNode }) {
  const toast = useToast();
  const [mode, setMode] = useState<Mode>('loading');
  const [user, setUser] = useState<Ctx['user']>(null);
  const [data, setData] = useState<AppData>(emptyData);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sync, setSync] = useState<SyncState>('idle');
  const [syncError, setSyncError] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  const [today, setToday] = useState(todayISO());
  const [month, setMonth] = useState<MonthKey>(today.slice(0, 7));

  const storeRef = useRef<DataStore | null>(null);
  const dataRef = useRef<AppData>(data);
  const versionRef = useRef(0);
  const savingRef = useRef(false);
  const dirtyRef = useRef(false);
  const timerRef = useRef<number | undefined>(undefined);
  /** Há alteração aguardando o debounce para ser gravada. */
  const pendingRef = useRef(false);
  const userRef = useRef<Ctx['user']>(null);

  // ───── Sessão / modo ─────
  useEffect(() => {
    if (!supabase) {
      setMode(localStorage.getItem(DEMO_FLAG) === 'demo' ? 'demo' : 'signed-out');
      return;
    }
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser({ id: session.user.id, email: session.user.email ?? '' });
        setMode('cloud');
      } else setMode(localStorage.getItem(DEMO_FLAG) === 'demo' ? 'demo' : 'signed-out');
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
      if (session?.user) {
        setUser((u) => (u?.id === session.user.id ? u : { id: session.user.id, email: session.user.email ?? '' }));
        setMode('cloud');
      } else {
        setUser(null);
        setMode((m) => (m === 'cloud' ? 'signed-out' : m));
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  // ───── Gravação ─────
  const flush = useCallback(async () => {
    const store = storeRef.current;
    if (!store) return;
    window.clearTimeout(timerRef.current);
    pendingRef.current = false;
    if (savingRef.current) {
      dirtyRef.current = true;
      return;
    }
    savingRef.current = true;
    dirtyRef.current = false;
    const snapshot = dataRef.current;
    setSync('saving');
    try {
      const res = await store.save(snapshot, versionRef.current);
      versionRef.current = res.version;
      setLastSaved(res.updatedAt);
      setSyncError(null);
      if (store.kind === 'cloud' && userRef.current) pendingQueue.clear(userRef.current.id);
      setSync('saved');
    } catch (e) {
      if (store.kind === 'cloud' && userRef.current)
        pendingQueue.set(userRef.current.id, { data: snapshot, baseVersion: versionRef.current, savedAt: new Date().toISOString() });
      if (e instanceof ConflictError) {
        setSync('conflict');
        dirtyRef.current = false;
      } else if (e instanceof NetworkError) {
        setSync('offline');
      } else {
        setSync('error');
        setSyncError((e as Error).message);
      }
      savingRef.current = false;
      return;
    }
    savingRef.current = false;
    if (dirtyRef.current || dataRef.current !== snapshot) void flush();
  }, []);

  const scheduleSave = useCallback(() => {
    pendingRef.current = true;
    window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => void flush(), 350);
  }, [flush]);

  // ───── Carregamento ─────
  const applySnapshot = (snap: Snapshot | null) => {
    const d = snap ? { ...emptyData(), ...snap.data } : emptyData();
    dataRef.current = d;
    versionRef.current = snap?.version ?? 0;
    setData(d);
    setLastSaved(snap?.updatedAt ?? null);
  };

  const load = useCallback(async () => {
    const store = storeRef.current;
    if (!store) return;
    setLoadError(null);
    try {
      const snap = await store.load();
      applySnapshot(snap);
      if (store.kind === 'cloud' && userRef.current) {
        const pending = pendingQueue.get(userRef.current.id);
        if (pending) {
          const remoteVersion = snap?.version ?? 0;
          if (pending.baseVersion === remoteVersion) {
            dataRef.current = pending.data;
            setData(pending.data);
            toast('Enviando alterações feitas offline…', 'info');
            void flush();
          } else {
            dataRef.current = pending.data;
            setData(pending.data);
            setSync('conflict');
          }
        } else setSync(snap ? 'saved' : 'idle');
      } else setSync(snap ? 'saved' : 'idle');
      setReady(true);
    } catch (e) {
      setLoadError(e instanceof NetworkError ? 'Sem conexão com o servidor.' : (e as Error).message);
      setReady(false);
    }
  }, [flush, toast]);

  useEffect(() => {
    setReady(false);
    if (mode === 'demo') storeRef.current = new LocalDemoStore();
    else if (mode === 'cloud' && user && supabase) storeRef.current = new SupabaseStore(supabase, user.id);
    else {
      storeRef.current = null;
      return;
    }
    void load();
  }, [mode, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ───── Conectividade e sincronização entre dispositivos ─────
  useEffect(() => {
    const on = () => {
      setOnline(true);
      if (sync === 'offline' || dirtyRef.current) void flush();
    };
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, [flush, sync]);

  const refreshFromCloud = useCallback(async () => {
    const store = storeRef.current;
    if (!store || store.kind !== 'cloud' || savingRef.current || dirtyRef.current || pendingRef.current) return;
    if (sync === 'offline' || sync === 'conflict' || sync === 'error') return;
    try {
      const snap = await store.load();
      if (snap && snap.version > versionRef.current) {
        applySnapshot(snap);
        toast('Dados atualizados a partir de outro dispositivo ✧', 'info');
      }
    } catch {
      /* silencioso: tentaremos de novo */
    }
  }, [sync, toast]);

  useEffect(() => {
    if (mode !== 'cloud') return;
    const onVis = () => document.visibilityState === 'visible' && void refreshFromCloud();
    window.addEventListener('focus', onVis);
    document.addEventListener('visibilitychange', onVis);
    const iv = window.setInterval(() => document.visibilityState === 'visible' && void refreshFromCloud(), 30000);
    return () => {
      window.removeEventListener('focus', onVis);
      document.removeEventListener('visibilitychange', onVis);
      window.clearInterval(iv);
    };
  }, [mode, refreshFromCloud]);

  // Atualiza "hoje" na virada do dia
  useEffect(() => {
    const iv = window.setInterval(() => setToday(todayISO()), 60000);
    return () => window.clearInterval(iv);
  }, []);

  // Mês inicial respeita o primeiro dia do mês financeiro
  const startDay = data.settings.monthStartDay;
  useEffect(() => {
    if (ready) setMonth(monthOfToday(dataRef.current, todayISO()));
  }, [ready, startDay]);

  // Tema e movimento reduzido
  useEffect(() => {
    document.documentElement.dataset.theme = data.settings.theme;
    document.documentElement.classList.toggle('reduce-motion', !!data.settings.reduceMotion);
  }, [data.settings.theme, data.settings.reduceMotion]);

  // Ao sair/ocultar a página, grava imediatamente o que estiver no debounce;
  // e avisa antes de fechar se ainda houver gravação em andamento.
  useEffect(() => {
    const flushNow = () => {
      if (pendingRef.current) void flush();
    };
    const onHide = () => document.visibilityState === 'hidden' && flushNow();
    const h = (e: BeforeUnloadEvent) => {
      flushNow();
      if (savingRef.current || dirtyRef.current || sync === 'offline') {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', h);
    window.addEventListener('pagehide', flushNow);
    document.addEventListener('visibilitychange', onHide);
    return () => {
      window.removeEventListener('beforeunload', h);
      window.removeEventListener('pagehide', flushNow);
      document.removeEventListener('visibilitychange', onHide);
    };
  }, [sync, flush]);

  // ───── API ─────
  const update = useCallback(
    (fn: (d: AppData) => AppData, successMsg?: string) => {
      try {
        const next = fn(dataRef.current);
        dataRef.current = next;
        setData(next);
        if (successMsg) toast(successMsg, 'success');
        scheduleSave();
        return true;
      } catch (e) {
        toast(e instanceof OpError ? e.message : 'Algo deu errado: ' + (e as Error).message, 'error');
        if (!(e instanceof OpError)) console.error(e);
        return false;
      }
    },
    [scheduleSave, toast],
  );

  const startDemo = useCallback(() => {
    localStorage.setItem(DEMO_FLAG, 'demo');
    setMode('demo');
  }, []);

  const leaveDemo = useCallback(async () => {
    localStorage.removeItem(DEMO_FLAG);
    setMode('signed-out');
  }, []);

  const signOut = useCallback(async () => {
    if (mode === 'cloud' && supabase) {
      window.clearTimeout(timerRef.current);
      if (dirtyRef.current || sync === 'saving') await flush();
      await supabase.auth.signOut();
      applySnapshot(null);
      setMode('signed-out');
    } else await leaveDemo();
  }, [mode, flush, leaveDemo, sync]);

  const resolveConflict = useCallback(
    async (keep: 'cloud' | 'local') => {
      const store = storeRef.current;
      if (!store) return;
      try {
        const remote = await store.load();
        if (keep === 'cloud') {
          applySnapshot(remote);
          if (userRef.current) pendingQueue.clear(userRef.current.id);
          setSync('saved');
          toast('Dados da nuvem carregados.', 'info');
        } else {
          versionRef.current = remote?.version ?? 0;
          await flush();
        }
      } catch (e) {
        toast('Não foi possível resolver agora: ' + (e as Error).message, 'error');
      }
    },
    [flush, toast],
  );

  const wipeAll = useCallback(async () => {
    const store = storeRef.current;
    if (!store) return;
    await store.wipe();
    if (userRef.current) pendingQueue.clear(userRef.current.id);
    applySnapshot(null);
    setSync('idle');
  }, []);

  const deleteAccount = useCallback(async () => {
    const store = storeRef.current;
    if (store instanceof SupabaseStore) {
      await store.deleteAccount();
      if (userRef.current) pendingQueue.clear(userRef.current.id);
      await supabase?.auth.signOut();
      applySnapshot(null);
      setMode('signed-out');
    } else {
      await store?.wipe();
      applySnapshot(null);
      await leaveDemo();
    }
  }, [leaveDemo]);

  const value = useMemo<Ctx>(
    () => ({
      mode, user, data, ready, loadError, sync, syncError, lastSaved, online, today, month, setMonth,
      update, startDemo, leaveDemo, signOut,
      retrySync: () => void flush(),
      resolveConflict, reload: load, wipeAll, deleteAccount,
    }),
    [mode, user, data, ready, loadError, sync, syncError, lastSaved, online, today, month, update, startDemo, leaveDemo, signOut, flush, resolveConflict, load, wipeAll, deleteAccount],
  );
  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

export function useApp() {
  const c = useContext(AppCtx);
  if (!c) throw new Error('useApp fora do AppProvider');
  return c;
}
