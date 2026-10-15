/**
 * Camada de persistência. A aplicação conversa apenas com a interface DataStore;
 * há duas implementações:
 *  - LocalDemoStore: modo demonstração, salva SOMENTE no navegador atual (localStorage).
 *  - SupabaseStore: banco remoto, uma linha por usuário em `glossy_user_data`,
 *    protegida por RLS (cada usuário só lê/escreve a própria linha).
 *
 * Concorrência: cada gravação envia a versão que foi carregada. Se outro dispositivo
 * salvou antes, a versão não confere e a gravação é recusada (ConflictError) — assim
 * nenhum dispositivo sobrescreve silenciosamente os dados do outro.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { AppData } from '../data/types';

export interface Snapshot {
  data: AppData;
  version: number;
  updatedAt: string | null;
}

export class ConflictError extends Error {
  constructor() {
    super('Os dados foram alterados em outro dispositivo.');
  }
}
export class NetworkError extends Error {}

export interface DataStore {
  kind: 'demo' | 'cloud';
  load(): Promise<Snapshot | null>;
  /** Grava e devolve a nova versão. `expectedVersion` 0 = primeira gravação. */
  save(data: AppData, expectedVersion: number): Promise<{ version: number; updatedAt: string }>;
  /** Remove todos os dados financeiros do usuário. */
  wipe(): Promise<void>;
}

const DEMO_KEY = 'glossy-money:demo:v1';

export class LocalDemoStore implements DataStore {
  kind = 'demo' as const;
  async load(): Promise<Snapshot | null> {
    try {
      const raw = localStorage.getItem(DEMO_KEY);
      return raw ? (JSON.parse(raw) as Snapshot) : null;
    } catch {
      return null;
    }
  }
  async save(data: AppData, expectedVersion: number) {
    const updatedAt = new Date().toISOString();
    const version = expectedVersion + 1;
    try {
      localStorage.setItem(DEMO_KEY, JSON.stringify({ data, version, updatedAt }));
    } catch (e) {
      throw new Error('Não foi possível salvar no navegador (armazenamento cheio ou bloqueado).');
    }
    return { version, updatedAt };
  }
  async wipe() {
    localStorage.removeItem(DEMO_KEY);
  }
}

const TABLE = 'glossy_user_data';

function isNetworkError(e: unknown) {
  const msg = String((e as { message?: string })?.message ?? e);
  return !navigator.onLine || /fetch|network|Failed to fetch|NetworkError|timeout/i.test(msg);
}

export class SupabaseStore implements DataStore {
  kind = 'cloud' as const;
  constructor(
    private client: SupabaseClient,
    private userId: string,
  ) {}

  async load(): Promise<Snapshot | null> {
    const { data, error } = await this.client
      .from(TABLE)
      .select('data, version, updated_at')
      .eq('user_id', this.userId)
      .maybeSingle();
    if (error) throw isNetworkError(error) ? new NetworkError(error.message) : new Error(error.message);
    if (!data) return null;
    return { data: data.data as AppData, version: data.version as number, updatedAt: data.updated_at as string };
  }

  async save(appData: AppData, expectedVersion: number) {
    try {
      if (expectedVersion === 0) {
        const { data, error } = await this.client
          .from(TABLE)
          .insert({ user_id: this.userId, data: appData, version: 1 })
          .select('version, updated_at')
          .single();
        if (error) {
          if (error.code === '23505') throw new ConflictError(); // já existe linha
          throw error;
        }
        return { version: data.version as number, updatedAt: data.updated_at as string };
      }
      const { data, error } = await this.client
        .from(TABLE)
        .update({ data: appData, version: expectedVersion + 1 })
        .eq('user_id', this.userId)
        .eq('version', expectedVersion)
        .select('version, updated_at');
      if (error) throw error;
      if (!data || data.length === 0) throw new ConflictError();
      return { version: data[0].version as number, updatedAt: data[0].updated_at as string };
    } catch (e) {
      if (e instanceof ConflictError) throw e;
      if (isNetworkError(e)) throw new NetworkError(String((e as Error).message ?? e));
      throw new Error((e as Error).message ?? 'Erro ao salvar.');
    }
  }

  async wipe() {
    const { error } = await this.client.from(TABLE).delete().eq('user_id', this.userId);
    if (error) throw new Error(error.message);
  }

  /** Exclui a conta de autenticação (função SQL `delete_my_account`, só afeta o próprio usuário). */
  async deleteAccount() {
    const { error } = await this.client.rpc('delete_my_account');
    if (error) throw new Error(error.message);
  }
}

// ───── Fila offline: alterações confirmadas que ainda não chegaram à nuvem ─────

interface PendingCloud {
  data: AppData;
  baseVersion: number;
  savedAt: string;
}
const pendingKey = (uid: string) => `glossy-money:pending:${uid}`;

export const pendingQueue = {
  get(uid: string): PendingCloud | null {
    try {
      const raw = localStorage.getItem(pendingKey(uid));
      return raw ? (JSON.parse(raw) as PendingCloud) : null;
    } catch {
      return null;
    }
  },
  set(uid: string, p: PendingCloud) {
    try {
      localStorage.setItem(pendingKey(uid), JSON.stringify(p));
    } catch {
      /* sem espaço: a alteração continua em memória */
    }
  },
  clear(uid: string) {
    try {
      localStorage.removeItem(pendingKey(uid));
    } catch {
      /* ignore */
    }
  },
};
