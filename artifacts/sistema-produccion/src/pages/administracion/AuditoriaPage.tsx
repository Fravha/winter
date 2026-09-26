import { useState } from 'react';
import type { AuditLog, AuditLogQuery } from '@/features/admin/types';
import { PageHeader } from '@/components/shared/PageHeader';
import { useAuditLogs } from '@/features/admin/api/admin.hooks';
import { AuditTable } from '@/features/admin/components/audit/AuditTable';
import { AuditFilters } from '@/features/admin/components/audit/AuditFilters';
import { AuditDetailDialog } from '@/features/admin/components/audit/AuditDetailDialog';
import { AdminErrorAlert } from '@/features/admin/components/shared/admin-error-mapper';

export default function AuditoriaPage() {
  const [query, setQuery] = useState<AuditLogQuery>({
    page: 1,
    pageSize: 20,
  });

  const { data: response, isLoading, error } = useAuditLogs(query, { enabled: true });

  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const handleFilterChange = (newFilters: Omit<AuditLogQuery, 'page' | 'pageSize'>) => {
    setQuery((prev) => ({ ...prev, ...newFilters, page: 1 }));
  };

  const handlePageChange = (newPage: number) => {
    setQuery((prev) => ({ ...prev, page: newPage }));
  };

  const handlePageSizeChange = (newSize: number) => {
    setQuery((prev) => ({ ...prev, pageSize: newSize, page: 1 }));
  };

  const handleReset = () => {
    setQuery({
      page: 1,
      pageSize: query.pageSize,
      action: undefined,
      resourceType: undefined,
      actorUserId: undefined,
      resourceId: undefined,
      from: undefined,
      to: undefined,
    });
  };

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto py-6">
      <PageHeader
        eyebrow="Administración"
        title="Auditoría"
        description="Consulta del registro de eventos y operaciones del sistema."
      />

      <AuditFilters
        filters={query}
        onChange={handleFilterChange}
        onReset={handleReset}
      />

      {error && <AdminErrorAlert error={error} />}

      <AuditTable
        logs={response?.data || []}
        meta={response?.meta}
        isLoading={isLoading}
        hasError={!!error}
        pageSize={query.pageSize ?? 20}
        onViewDetails={setSelectedLog}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
      />

      <AuditDetailDialog
        log={selectedLog}
        open={!!selectedLog}
        onOpenChange={(open: boolean) => !open && setSelectedLog(null)}
      />
    </div>
  );
}
