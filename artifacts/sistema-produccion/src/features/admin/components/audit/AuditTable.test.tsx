import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { AuditLog } from '@/features/admin/types';
import { AuditTable } from './AuditTable';

const log = {
  id: 'event-1',
  actorUserId: 'actor-1',
  action: 'UPDATE',
  resourceType: 'ARTICLE',
  resourceId: 'article-1',
  metadata: {},
  ipAddress: null,
  requestId: 'request-1',
  createdAt: '2025-01-15T12:30:00.000Z',
} satisfies AuditLog;

describe('AuditTable', () => {
  it('keeps the wide audit table scrollable inside its own container', () => {
    render(
      <AuditTable
        logs={[log]}
        meta={{ page: 1, pageSize: 20, total: 1, totalPages: 1 }}
        isLoading={false}
        hasError={false}
        pageSize={20}
        onViewDetails={vi.fn()}
        onPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
      />,
    );

    const table = screen.getByRole('table');
    expect(table.className).toContain('min-w-[900px]');
    expect(table.parentElement?.className).toContain('overflow-auto');
  });
});