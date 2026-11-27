import React from 'react';
import { cn } from '../../../utils/cn';

/** Result line under a credential test: green on success, red on failure. */
export function StatusMessage({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <div role="status" className={cn('text-ui font-semibold', ok ? 'text-accent-green' : 'text-accent-red')}>
      {children}
    </div>
  );
}
