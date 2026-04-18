import WebSocket from "ws";
import type { ProtocolMapping } from "devtools-protocol/types/protocol-mapping.js";

type Method = keyof ProtocolMapping.Commands;
type Event = keyof ProtocolMapping.Events;
type Params<M extends Method> = ProtocolMapping.Commands[M]["paramsType"][0];
type Return<M extends Method> = ProtocolMapping.Commands[M]["returnType"];
type EventPayload<E extends Event> = ProtocolMapping.Events[E][0];

interface Pending {
  resolve: (value: unknown) => void;
  reject: (err: Error) => void;
}

interface CDPMessage {
  id?: number;
  method?: string;
  params?: unknown;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

export interface CDPSession {
  send<M extends Method>(method: M, params?: Params<M>): Promise<Return<M>>;
  on<E extends Event>(event: E, handler: (payload: EventPayload<E>) => void): () => void;
  close(): Promise<void>;
}

export async function connectCDP(wsUrl: string): Promise<CDPSession> {
  const ws = new WebSocket(wsUrl, { perMessageDeflate: false, maxPayload: 256 * 1024 * 1024 });
  await new Promise<void>((resolve, reject) => {
    ws.once("open", () => resolve());
    ws.once("error", reject);
  });

  let nextId = 1;
  const pending = new Map<number, Pending>();
  const listeners = new Map<string, Set<(payload: unknown) => void>>();
  let closed = false;

  ws.on("message", (data) => {
    const text = typeof data === "string" ? data : data.toString("utf8");
    let msg: CDPMessage;
    try {
      msg = JSON.parse(text) as CDPMessage;
    } catch {
      return;
    }
    if (msg.id !== undefined) {
      const p = pending.get(msg.id);
      if (!p) return;
      pending.delete(msg.id);
      if (msg.error) p.reject(new Error(`CDP ${msg.error.code}: ${msg.error.message}`));
      else p.resolve(msg.result);
    } else if (msg.method) {
      const subs = listeners.get(msg.method);
      if (subs) for (const fn of subs) fn(msg.params);
    }
  });

  const failAll = (err: Error) => {
    for (const p of pending.values()) p.reject(err);
    pending.clear();
  };
  ws.on("close", () => {
    closed = true;
    failAll(new Error("CDP connection closed"));
  });
  ws.on("error", (err) => failAll(err as Error));

  return {
    send(method, params) {
      if (closed) return Promise.reject(new Error("CDP connection closed"));
      const id = nextId++;
      const payload = JSON.stringify({ id, method, params: params ?? {} });
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve: resolve as (v: unknown) => void, reject });
        ws.send(payload, (err) => {
          if (err) {
            pending.delete(id);
            reject(err);
          }
        });
      }) as Promise<Return<typeof method>>;
    },
    on(event, handler) {
      let subs = listeners.get(event);
      if (!subs) {
        subs = new Set();
        listeners.set(event, subs);
      }
      const wrapped = handler as (payload: unknown) => void;
      subs.add(wrapped);
      return () => subs!.delete(wrapped);
    },
    async close() {
      if (closed) return;
      closed = true;
      await new Promise<void>((resolve) => {
        ws.once("close", () => resolve());
        ws.close();
      });
    },
  };
}
