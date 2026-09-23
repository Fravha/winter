import type { InventoryReleaseWarehouseDto, ProductionReleaseDto, ReleaseBatchInput, ReverseReleaseInput, ReleaseBatchResult , ReverseReleaseResult } from '../types/production.types';
import { request } from '@/lib/api/request';
import type {
  Catalog, CatalogCreateInput, CatalogFilters, CatalogUpdateInput, CustomFieldDefinition,
  CustomFieldDefinitionCreateInput, CustomFieldDefinitionUpdateInput, CustomFieldValue,
  CustomFieldValueInput, Envelope, ListEnvelope, Participant, ParticipantCreateInput,
  ParticipantUpdateInput, ProductionOrder, ProductionOrderCreateInput, ProductionOrderDetail,
  ProductionOrderFilters, TransformationOrder, TransformationOrderCreateInput,
  TransformationOrderDetail, TransformationOrderFilters, BatchListFilters, GrapeReceptionCreateInput,
  ReceptionCorrectionInput, ReceptionListFilters, GrapeReceptionDetail, ReceptionResult,
  ReceptionCorrectionResult, ProductionBatch, ProductionBatchBalanceResult, GrapeReceptionBase, GrapeReceptionListItem,
  ProductionContainer, ProductionContainerDetail, WorkListFilters, ProductionWork, ProductionWorkCreateInput,
  WorkCorrectionInput, MeasurementListFilters, ProductionMeasurement, ProductionMeasurementCreateInput,
  MeasurementCorrectionInput, MeasurementCorrectionResult,
  TransformationListFilters, Transformation, TransformationCreateInput,
  ContainerCreateInput, ContainerUpdateInput, ContainerAssignInput,
  ContainerTransferTotalInput, ContainerTransferPartialInput,
  Occupancy, ProcessMovement
} from '../types/production.types';

const query = (values: Record<string, string | number | boolean | undefined>) => {
  const params = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => { if (value !== undefined && value !== '') params.set(key, String(value)); });
  return params.toString() ? `?${params}` : '';
};
const cleanOptional = <T extends Record<string, unknown>>(input: T): Partial<T> =>
  Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined && value !== '')) as Partial<T>;
type CatalogResult = Catalog | Participant;

async function catalogList<T extends CatalogResult>(path: string, filters: CatalogFilters, signal?: AbortSignal) {
  return request<ListEnvelope<T>>( `production/${path}${query(filters)}`, { signal });
}
async function catalogCreate<T extends CatalogResult>(path: string, input: CatalogCreateInput | ParticipantCreateInput) {
  return (await request<Envelope<T>>(`production/${path}`, { method: 'POST', body: cleanOptional(input) })).data;
}
async function catalogUpdate<T extends CatalogResult>(path: string, id: string, input: CatalogUpdateInput) {
  return (await request<Envelope<T>>(`production/${path}/${id}`, { method: 'PATCH', body: input })).data;
}
async function catalogCommand<T extends CatalogResult>(path: string, id: string, command: 'activate' | 'deactivate') {
  return (await request<Envelope<T>>(`production/${path}/${id}/${command}`, { method: 'POST' })).data;
}
export const getParticipants = (filters: CatalogFilters = {}, signal?: AbortSignal) => catalogList<Participant>('participants', filters, signal);
export const createParticipant = (input: ParticipantCreateInput) => catalogCreate<Participant>('participants', input);
export const updateParticipant = (id: string, input: ParticipantUpdateInput) => catalogUpdate<Participant>('participants', id, input);
export const activateParticipant = (id: string) => catalogCommand<Participant>('participants', id, 'activate');
export const deactivateParticipant = (id: string) => catalogCommand<Participant>('participants', id, 'deactivate');
export const getProducers = (filters: CatalogFilters = {}, signal?: AbortSignal) => catalogList<Catalog>('producers', filters, signal);
export const createProducer = (input: CatalogCreateInput) => catalogCreate<Catalog>('producers', input);
export const updateProducer = (id: string, input: CatalogUpdateInput) => catalogUpdate<Catalog>('producers', id, input);
export const activateProducer = (id: string) => catalogCommand<Catalog>('producers', id, 'activate');
export const deactivateProducer = (id: string) => catalogCommand<Catalog>('producers', id, 'deactivate');
export const getGrapeVarieties = (filters: CatalogFilters = {}, signal?: AbortSignal) => catalogList<Catalog>('grape-varieties', filters, signal);
export const createGrapeVariety = (input: CatalogCreateInput) => catalogCreate<Catalog>('grape-varieties', input);
export const updateGrapeVariety = (id: string, input: CatalogUpdateInput) => catalogUpdate<Catalog>('grape-varieties', id, input);
export const activateGrapeVariety = (id: string) => catalogCommand<Catalog>('grape-varieties', id, 'activate');
export const deactivateGrapeVariety = (id: string) => catalogCommand<Catalog>('grape-varieties', id, 'deactivate');
export const getWorkTypes = (filters: CatalogFilters = {}, signal?: AbortSignal) => catalogList<Catalog>('work-types', filters, signal);
export const createWorkType = (input: CatalogCreateInput) => catalogCreate<Catalog>('work-types', input);
export const updateWorkType = (id: string, input: CatalogUpdateInput) => catalogUpdate<Catalog>('work-types', id, input);
export const activateWorkType = (id: string) => catalogCommand<Catalog>('work-types', id, 'activate');
export const deactivateWorkType = (id: string) => catalogCommand<Catalog>('work-types', id, 'deactivate');
export const getMeasurementTypes = (filters: CatalogFilters = {}, signal?: AbortSignal) => catalogList<Catalog>('measurement-types', filters, signal);
export const createMeasurementType = (input: CatalogCreateInput) => catalogCreate<Catalog>('measurement-types', input);
export const updateMeasurementType = (id: string, input: CatalogUpdateInput) => catalogUpdate<Catalog>('measurement-types', id, input);
export const activateMeasurementType = (id: string) => catalogCommand<Catalog>('measurement-types', id, 'activate');
export const deactivateMeasurementType = (id: string) => catalogCommand<Catalog>('measurement-types', id, 'deactivate');

export async function getCustomFieldDefinitions(signal?: AbortSignal) { return request<Envelope<CustomFieldDefinition[]>>('production/custom-fields/definitions', { signal }); }
export async function createCustomFieldDefinition(input: CustomFieldDefinitionCreateInput) { return (await request<Envelope<CustomFieldDefinition>>('production/custom-fields/definitions', { method: 'POST', body: cleanOptional(input) })).data; }
export async function updateCustomFieldDefinition(id: string, input: CustomFieldDefinitionUpdateInput) { return (await request<Envelope<CustomFieldDefinition>>(`production/custom-fields/definitions/${id}`, { method: 'PATCH', body: cleanOptional(input) })).data; }
export async function activateCustomFieldDefinition(id: string) { return (await request<Envelope<CustomFieldDefinition>>(`production/custom-fields/definitions/${id}/activate`, { method: 'POST' })).data; }
export async function deactivateCustomFieldDefinition(id: string) { return (await request<Envelope<CustomFieldDefinition>>(`production/custom-fields/definitions/${id}/deactivate`, { method: 'POST' })).data; }
export async function upsertCustomFieldValue(input: CustomFieldValueInput) { return (await request<Envelope<CustomFieldValue>>('production/custom-fields/values', { method: 'PUT', body: input })).data; }

export async function getProductionOrders(filters: ProductionOrderFilters = {}, signal?: AbortSignal) { return request<ListEnvelope<ProductionOrder>>(`production/orders${query(filters)}`, { signal }); }
export async function getProductionOrder(id: string, signal?: AbortSignal) { return (await request<Envelope<ProductionOrderDetail>>(`production/orders/${id}`, { signal })).data; }
export async function createProductionOrder(input: ProductionOrderCreateInput) { return (await request<Envelope<ProductionOrder>>('production/orders', { method: 'POST', body: cleanOptional(input) })).data; }
export async function closeProductionOrder(id: string) { return (await request<Envelope<ProductionOrder>>(`production/orders/${id}/close`, { method: 'POST' })).data; }
export async function getTransformationOrders(filters: TransformationOrderFilters = {}, signal?: AbortSignal) { return request<ListEnvelope<TransformationOrderDetail>>(`production/transformation-orders${query(filters)}`, { signal }); }
export async function getTransformationOrder(id: string, signal?: AbortSignal) { return (await request<Envelope<TransformationOrderDetail>>(`production/transformation-orders/${id}`, { signal })).data; }
export async function createTransformationOrder(input: TransformationOrderCreateInput) { return (await request<Envelope<TransformationOrder>>('production/transformation-orders', { method: 'POST', body: cleanOptional(input) })).data; }
export async function closeTransformationOrder(id: string) { return (await request<Envelope<TransformationOrder>>(`production/transformation-orders/${id}/close`, { method: 'POST' })).data; }

export async function getGrapeReceptions(filters: ReceptionListFilters = {}, signal?: AbortSignal) {
  return request<ListEnvelope<GrapeReceptionListItem>>(`production/grape-receptions${query(filters)}`, { signal });
}
export async function getGrapeReception(id: string, signal?: AbortSignal) {
  return (await request<Envelope<GrapeReceptionDetail>>(`production/grape-receptions/${id}`, { signal })).data;
}
export async function createGrapeReception(input: GrapeReceptionCreateInput) {
  return (await request<Envelope<ReceptionResult>>('production/grape-receptions', { method: 'POST', body: input })).data;
}
export async function correctGrapeReception(id: string, input: ReceptionCorrectionInput) {
  return (await request<Envelope<ReceptionCorrectionResult>>(`production/grape-receptions/${id}/corrections`, { method: 'POST', body: input })).data;
}
export async function getProductionBatches(filters: BatchListFilters = {}, signal?: AbortSignal) {
  return request<ListEnvelope<ProductionBatch>>(`production/batches${query(filters)}`, { signal });
}
export async function getProductionBatch(id: string, signal?: AbortSignal) {
  return (await request<Envelope<ProductionBatch>>(`production/batches/${id}`, { signal })).data;
}
export async function getProductionBatchBalance(id: string, signal?: AbortSignal) {
  return (await request<Envelope<ProductionBatchBalanceResult>>(`production/batches/${id}/balance`, { signal })).data;
}
export async function getProductionBatchTrace(id: string, signal?: AbortSignal) {
  return (await request<Envelope<import('../types/production.types').ProductionBatchTraceDto>>(`production/batches/${id}/trace`, { signal })).data;
}

export async function getProductionContainers(signal?: AbortSignal) {
  return request<Envelope<ProductionContainer[]>>('production/containers', { signal });
}
export async function getProductionContainer(id: string, signal?: AbortSignal) {
  return (await request<Envelope<ProductionContainerDetail>>(`production/containers/${id}`, { signal })).data;
}
export async function getProductionContainerOccupancies(id: string, signal?: AbortSignal) {
  return request<Envelope<Occupancy[]>>(`production/containers/${id}/occupancies`, { signal });
}
export async function getProductionContainerMovements(id: string, signal?: AbortSignal) {
  return request<Envelope<ProcessMovement[]>>(`production/containers/${id}/movements`, { signal });
}
export async function createProductionContainer(input: ContainerCreateInput) {
  return (await request<Envelope<ProductionContainer>>('production/containers', { method: 'POST', body: cleanOptional(input) })).data;
}
export async function updateProductionContainer(id: string, input: ContainerUpdateInput) {
  return (await request<Envelope<ProductionContainer>>(`production/containers/${id}`, { method: 'PATCH', body: cleanOptional(input) })).data;
}
export async function activateProductionContainer(id: string) {
  return (await request<Envelope<ProductionContainer>>(`production/containers/${id}/activate`, { method: 'POST' })).data;
}
export async function deactivateProductionContainer(id: string) {
  return (await request<Envelope<ProductionContainer>>(`production/containers/${id}/deactivate`, { method: 'POST' })).data;
}
export async function assignProductionContainer(id: string, input: ContainerAssignInput) {
  return (await request<Envelope<void>>(`production/containers/${id}/assign`, { method: 'POST', body: cleanOptional(input) })).data;
}
export async function transferProductionContainerTotal(sourceId: string, input: ContainerTransferTotalInput) {
  return (await request<Envelope<void>>(`production/containers/${sourceId}/transfers`, { method: 'POST', body: cleanOptional(input) })).data;
}
export async function transferProductionContainerPartial(sourceId: string, input: ContainerTransferPartialInput) {
  return (await request<Envelope<void>>(`production/containers/${sourceId}/transfers/partial`, { method: 'POST', body: cleanOptional(input) })).data;
}
export async function getProductionWorks(filters: WorkListFilters = {}, signal?: AbortSignal) {
  return request<ListEnvelope<ProductionWork>>(`production/works${query(filters)}`, { signal });
}
export async function getProductionWork(id: string, signal?: AbortSignal) {
  return (await request<Envelope<ProductionWork>>(`production/works/${id}`, { signal })).data;
}
export async function createProductionWork(input: ProductionWorkCreateInput) {
  return (await request<Envelope<ProductionWork>>('production/works', { method: 'POST', body: { ...input, batchIds: input.batchIds ?? [], containerIds: input.containerIds ?? [], participants: input.participants ?? [] } })).data;
}
export async function correctProductionWork(id: string, input: WorkCorrectionInput) {
  return (await request<Envelope<ProductionWork>>(`production/works/${id}/corrections`, { method: 'POST', body: input })).data;
}
export async function createProductionWorkInput(workId: string, input: import('../types/production.types').WorkInputCreateInput) {
  return (await request<Envelope<import('../types/production.types').WorkInput>>(`production/works/${workId}/inputs`, { method: 'POST', body: cleanOptional(input) })).data;
}
export async function reverseProductionWorkInput(workId: string, inputId: string, input: import('../types/production.types').WorkInputReverseInput) {
  return (await request<Envelope<import('../types/production.types').WorkInput>>(`production/works/${workId}/inputs/${inputId}/reverse`, { method: 'POST', body: input })).data;
}
export async function getProductionMeasurements(filters: MeasurementListFilters = {}, signal?: AbortSignal) {
  return request<ListEnvelope<ProductionMeasurement>>(`production/measurements${query(filters)}`, { signal });
}
export async function getProductionMeasurement(id: string, signal?: AbortSignal) {
  return (await request<Envelope<ProductionMeasurement>>(`production/measurements/${id}`, { signal })).data;
}
export async function createProductionMeasurement(input: ProductionMeasurementCreateInput) {
  return (await request<Envelope<ProductionMeasurement>>('production/measurements', { method: 'POST', body: cleanOptional(input) })).data;
}
export async function correctProductionMeasurement(id: string, input: MeasurementCorrectionInput) {
  return (await request<Envelope<MeasurementCorrectionResult>>(`production/measurements/${id}/corrections`, { method: 'POST', body: input })).data;
}

export async function getTransformations(filters: TransformationListFilters = {}, signal?: AbortSignal) {
  return request<ListEnvelope<Transformation>>(`production/transformations${query(filters)}`, { signal });
}
export async function getTransformation(id: string, signal?: AbortSignal) {
  return (await request<Envelope<Transformation>>(`production/transformations/${id}`, { signal })).data;
}
export async function createTransformation(input: TransformationCreateInput) {
  return (await request<Envelope<Transformation>>('production/transformations', { method: 'POST', body: cleanOptional(input) })).data;
}
export async function listInventoryReleaseWarehouses(signal?: AbortSignal) {
  return request<Envelope<InventoryReleaseWarehouseDto[]>>('production/inventory-release/warehouses', { signal });
}

export async function releaseBatchToInventory(batchId: string, input: ReleaseBatchInput) {
  return request<Envelope<ReleaseBatchResult>>(`production/batches/${batchId}/release-to-inventory`, {
    method: 'POST',
    body: input as any
  });
}

export async function listBatchReleases(batchId: string, signal?: AbortSignal) {
  return request<Envelope<ProductionReleaseDto[]>>(`production/batches/${batchId}/releases`, { signal });
}

export async function reverseBatchRelease(batchId: string, releaseId: string, input: ReverseReleaseInput) {
  return request<Envelope<ReverseReleaseResult>>(`production/batches/${batchId}/releases/${releaseId}/reverse`, {
    method: 'POST',
    body: input
  });
}
