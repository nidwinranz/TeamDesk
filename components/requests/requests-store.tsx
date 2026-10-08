'use client';

import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { RequestDTO } from '@/lib/types';

interface CreatedRequests {
  created: RequestDTO[];
  add: (request: RequestDTO) => void;
}

const Ctx = createContext<CreatedRequests>({ created: [], add: () => undefined });

/**
 * Shares just-created requests between the "New request" dialog and the table,
 * so a new row appears immediately without depending on `router.refresh()` timing.
 * The next server render de-duplicates by id.
 */
export function RequestsProvider({ children }: { children: React.ReactNode }) {
  const [created, setCreated] = useState<RequestDTO[]>([]);
  const add = useCallback(
    (r: RequestDTO) => setCreated((prev) => [r, ...prev.filter((p) => p.id !== r.id)]),
    [],
  );
  const value = useMemo(() => ({ created, add }), [created, add]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useCreatedRequests = () => useContext(Ctx);
