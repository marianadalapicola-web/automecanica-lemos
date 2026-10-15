import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { ConflictError, SupabaseStore } from './stores';
import { emptyData } from '../data/defaults';

/** Simula o subconjunto do cliente Supabase usado pelo SupabaseStore, com uma "tabela" em memória. */
function fakeClient(rows: Map<string, { data: unknown; version: number; updated_at: string }>) {
  const builder = (op: 'select' | 'insert' | 'update' | 'delete', payload?: Record<string, unknown>) => {
    const filters: [string, unknown][] = [];
    const match = (uid: string, r: { version: number }) =>
      filters.every(([k, v]) => (k === 'user_id' ? uid === v : (r as Record<string, unknown>)[k] === v));
    const exec = () => {
      if (op === 'insert') {
        const uid = payload!.user_id as string;
        if (rows.has(uid)) return { data: null, error: { code: '23505', message: 'duplicate' } };
        const r = { data: payload!.data, version: 1, updated_at: 'now' };
        rows.set(uid, r);
        return { data: [r], error: null };
      }
      const hits = [...rows.entries()].filter(([uid, r]) => match(uid, r));
      if (op === 'update') {
        for (const [uid, r] of hits) rows.set(uid, { ...r, data: payload!.data, version: payload!.version as number, updated_at: 'later' });
        return { data: hits.map(([uid]) => rows.get(uid)), error: null };
      }
      if (op === 'delete') {
        hits.forEach(([uid]) => rows.delete(uid));
        return { data: null, error: null };
      }
      return { data: hits.map(([, r]) => r), error: null };
    };
    const b = {
      eq(k: string, v: unknown) { filters.push([k, v]); return b; },
      select() { return b; },
      maybeSingle: async () => { const r = exec(); return { data: (r.data as unknown[])?.[0] ?? null, error: r.error }; },
      single: async () => { const r = exec(); return { data: (r.data as unknown[])?.[0] ?? null, error: r.error }; },
      then(res: (v: unknown) => void) { res(exec()); },
    };
    return b;
  };
  return {
    from: () => ({
      select: () => builder('select'),
      insert: (p: Record<string, unknown>) => builder('insert', p),
      update: (p: Record<string, unknown>) => builder('update', p),
      delete: () => builder('delete'),
    }),
  } as unknown as SupabaseClient;
}

describe('SupabaseStore — sincronização entre dispositivos', () => {
  it('primeiro acesso insere; outro dispositivo carrega os mesmos dados', async () => {
    const rows = new Map();
    const celular = new SupabaseStore(fakeClient(rows), 'u1');
    expect(await celular.load()).toBeNull();
    const d = emptyData();
    d.settings.displayName = 'Mari';
    const r = await celular.save(d, 0);
    expect(r.version).toBe(1);
    const computador = new SupabaseStore(fakeClient(rows), 'u1');
    const snap = await computador.load();
    expect(snap?.version).toBe(1);
    expect(snap?.data.settings.displayName).toBe('Mari');
  });

  it('gravação com versão desatualizada gera conflito em vez de sobrescrever', async () => {
    const rows = new Map();
    const a = new SupabaseStore(fakeClient(rows), 'u1');
    const b = new SupabaseStore(fakeClient(rows), 'u1');
    await a.save(emptyData(), 0);
    const v2 = await a.save(emptyData(), 1);
    expect(v2.version).toBe(2);
    await expect(b.save(emptyData(), 1)).rejects.toBeInstanceOf(ConflictError);
    await expect(b.save(emptyData(), 0)).rejects.toBeInstanceOf(ConflictError);
    expect(rows.get('u1').version).toBe(2);
  });

  it('cada usuário lê apenas a própria linha (filtro no cliente; RLS no banco)', async () => {
    const rows = new Map();
    await new SupabaseStore(fakeClient(rows), 'ana').save(emptyData(), 0);
    expect(await new SupabaseStore(fakeClient(rows), 'bia').load()).toBeNull();
  });
});
