import { productionKeys } from './production.keys';
import { keepPreviousData, useMutation, useQuery, useQueryClient, type UseMutationOptions, type UseQueryOptions } from '@tanstack/react-query';
import * as api from './production.api';
import { productionKeys as k } from './production.keys';
import { inventoryKeys } from '../../inventory/api/inventory.keys';
import type { BatchListFilters, CatalogCreateInput, CatalogFilters, CatalogUpdateInput, CustomFieldDefinitionCreateInput, CustomFieldDefinitionUpdateInput, CustomFieldValueInput, GrapeReceptionCreateInput, ParticipantCreateInput, ProductionOrderCreateInput, ProductionOrderFilters, ReceptionCorrectionInput, ReceptionListFilters, TransformationOrderCreateInput, TransformationOrderFilters, WorkListFilters, ProductionWorkCreateInput, WorkCorrectionInput, MeasurementListFilters, ProductionMeasurementCreateInput, MeasurementCorrectionInput, TransformationListFilters, TransformationCreateInput, ProductionBatch, ProductionWork, ReleaseBatchInput, ReverseReleaseInput, ReleaseBatchResult } from '../types/production.types';

type Q<T> = Omit<UseQueryOptions<T, Error>, 'queryKey' | 'queryFn'>;
const query = <T>(key: readonly unknown[], fn: (signal: AbortSignal) => Promise<T>, options?: Q<T>, paged = true) =>
  useQuery({ ...options, queryKey: key, queryFn: ({ signal }) => fn(signal), placeholderData: paged ? (options?.placeholderData ?? keepPreviousData) : options?.placeholderData });
const mutation = <T, V>(fn: (v: V) => Promise<T>, options?: Omit<UseMutationOptions<T, Error, V>, 'mutationFn'>) =>
  useMutation({ ...options, mutationFn: fn, retry: false as const });
function catalogMutation<T, V>(fn: (v: V) => Promise<T>, lists: readonly unknown[], detail: (v: V) => readonly unknown[], options?: Omit<UseMutationOptions<T, Error, V>, 'mutationFn'>) {
  const qc = useQueryClient();
  return useMutation({ ...options, mutationFn: fn, retry: false as const, onSuccess: async (d, v, c, mc) => {
    await Promise.all([qc.invalidateQueries({ queryKey: lists }), qc.invalidateQueries({ queryKey: detail(v) })]);
    await options?.onSuccess?.(d, v, c, mc);
  }});
}
export const useParticipants = (f: CatalogFilters = {}, o?: Q<Awaited<ReturnType<typeof api.getParticipants>>>) => query(k.participantList(f), s => api.getParticipants(f, s), o);
export const useProducers = (f: CatalogFilters = {}, o?: Q<Awaited<ReturnType<typeof api.getProducers>>>) => query(k.producerList(f), s => api.getProducers(f, s), o);
export const useGrapeVarieties = (f: CatalogFilters = {}, o?: Q<Awaited<ReturnType<typeof api.getGrapeVarieties>>>) => query(k.grapeVarietyList(f), s => api.getGrapeVarieties(f, s), o);
export const useWorkTypes = (f: CatalogFilters = {}, o?: Q<Awaited<ReturnType<typeof api.getWorkTypes>>>) => query(k.workTypeList(f), s => api.getWorkTypes(f, s), o);
export const useMeasurementTypes = (f: CatalogFilters = {}, o?: Q<Awaited<ReturnType<typeof api.getMeasurementTypes>>>) => query(k.measurementTypeList(f), s => api.getMeasurementTypes(f, s), o);
export const useProductionOrder = (id: string, o?: Q<Awaited<ReturnType<typeof api.getProductionOrder>>>) => query(k.order(id), s => api.getProductionOrder(id, s), o, false);
export const useProductionOrders = (f: ProductionOrderFilters = {}, o?: Q<Awaited<ReturnType<typeof api.getProductionOrders>>>) => query(k.orderList(f), s => api.getProductionOrders(f, s), o);
export const useTransformationOrder = (id: string, o?: Q<Awaited<ReturnType<typeof api.getTransformationOrder>>>) => query(k.transformationOrder(id), s => api.getTransformationOrder(id, s), o, false);
export const useTransformationOrders = (f: TransformationOrderFilters = {}, o?: Q<Awaited<ReturnType<typeof api.getTransformationOrders>>>) => query(k.transformationOrderList(f), s => api.getTransformationOrders(f, s), o);
export const useCustomFieldDefinitions = (o?: Q<Awaited<ReturnType<typeof api.getCustomFieldDefinitions>>>) => query(k.customFieldDefinitions(), s => api.getCustomFieldDefinitions(s), o, false);

export const useCreateParticipant = (o?: Omit<UseMutationOptions<Awaited<ReturnType<typeof api.createParticipant>>, Error, ParticipantCreateInput>, 'mutationFn'>) => catalogMutation(api.createParticipant, k.participantLists(), () => k.participantLists(), o);
export const useUpdateParticipant = (o?: Omit<UseMutationOptions<Awaited<ReturnType<typeof api.updateParticipant>>, Error, { id: string; input: CatalogUpdateInput }>, 'mutationFn'>) => catalogMutation(v => api.updateParticipant(v.id, v.input), k.participantLists(), v => k.participant(v.id), o);
export const useActivateParticipant = (o?: Omit<UseMutationOptions<Awaited<ReturnType<typeof api.activateParticipant>>, Error, string>, 'mutationFn'>) => catalogMutation(api.activateParticipant, k.participantLists(), id => k.participant(id), o);
export const useDeactivateParticipant = (o?: Omit<UseMutationOptions<Awaited<ReturnType<typeof api.deactivateParticipant>>, Error, string>, 'mutationFn'>) => catalogMutation(api.deactivateParticipant, k.participantLists(), id => k.participant(id), o);

type CatalogMutationOptions<T, V> = Omit<UseMutationOptions<T, Error, V>, 'mutationFn'>;
function makeCatalogHooks<TCreate extends CatalogCreateInput, TResult>(
  create: (v: TCreate) => Promise<TResult>, update: (id: string, v: CatalogUpdateInput) => Promise<TResult>,
  activate: (id: string) => Promise<TResult>, deactivate: (id: string) => Promise<TResult>,
  lists: readonly unknown[], detail: (id: string) => readonly unknown[],
) {
  return {
    useCreate: (o?: CatalogMutationOptions<TResult, TCreate>) => catalogMutation(create, lists, () => lists, o),
    useUpdate: (o?: CatalogMutationOptions<TResult, { id: string; input: CatalogUpdateInput }>) => catalogMutation(v => update(v.id, v.input), lists, v => detail(v.id), o),
    useActivate: (o?: CatalogMutationOptions<TResult, string>) => catalogMutation(activate, lists, detail, o),
    useDeactivate: (o?: CatalogMutationOptions<TResult, string>) => catalogMutation(deactivate, lists, detail, o),
  };
}
export const producerHooks = makeCatalogHooks(api.createProducer, api.updateProducer, api.activateProducer, api.deactivateProducer, k.producerLists(), k.producer);
export const grapeVarietyHooks = makeCatalogHooks(api.createGrapeVariety, api.updateGrapeVariety, api.activateGrapeVariety, api.deactivateGrapeVariety, k.grapeVarietyLists(), k.grapeVariety);
export const workTypeHooks = makeCatalogHooks(api.createWorkType, api.updateWorkType, api.activateWorkType, api.deactivateWorkType, k.workTypeLists(), k.workType);
export const measurementTypeHooks = makeCatalogHooks(api.createMeasurementType, api.updateMeasurementType, api.activateMeasurementType, api.deactivateMeasurementType, k.measurementTypeLists(), k.measurementType);
export const useCreateProducer = producerHooks.useCreate; export const useUpdateProducer = producerHooks.useUpdate; export const useActivateProducer = producerHooks.useActivate; export const useDeactivateProducer = producerHooks.useDeactivate;
export const useCreateGrapeVariety = grapeVarietyHooks.useCreate; export const useUpdateGrapeVariety = grapeVarietyHooks.useUpdate; export const useActivateGrapeVariety = grapeVarietyHooks.useActivate; export const useDeactivateGrapeVariety = grapeVarietyHooks.useDeactivate;
export const useCreateWorkType = workTypeHooks.useCreate; export const useUpdateWorkType = workTypeHooks.useUpdate; export const useActivateWorkType = workTypeHooks.useActivate; export const useDeactivateWorkType = workTypeHooks.useDeactivate;
export const useCreateMeasurementType = measurementTypeHooks.useCreate; export const useUpdateMeasurementType = measurementTypeHooks.useUpdate; export const useActivateMeasurementType = measurementTypeHooks.useActivate; export const useDeactivateMeasurementType = measurementTypeHooks.useDeactivate;

export const useCreateProductionOrder = (o?: Omit<UseMutationOptions<Awaited<ReturnType<typeof api.createProductionOrder>>, Error, ProductionOrderCreateInput>, 'mutationFn'>) => { const qc = useQueryClient(); return useMutation({ ...o, mutationFn: api.createProductionOrder, retry: false as const, onSuccess: async (d,v,c,mc) => { await qc.invalidateQueries({ queryKey: k.orderLists() }); await o?.onSuccess?.(d,v,c,mc); } }); };
export const useCloseProductionOrder = (o?: Omit<UseMutationOptions<Awaited<ReturnType<typeof api.closeProductionOrder>>, Error, string>, 'mutationFn'>) => { const qc = useQueryClient(); return useMutation({ ...o, mutationFn: api.closeProductionOrder, retry: false as const, onSuccess: async (d,v,c,mc) => { await Promise.all([qc.invalidateQueries({ queryKey: k.orderLists() }), qc.invalidateQueries({ queryKey: k.order(v) })]); await o?.onSuccess?.(d,v,c,mc); } }); };
export const useCreateTransformationOrder = (o?: Omit<UseMutationOptions<Awaited<ReturnType<typeof api.createTransformationOrder>>, Error, TransformationOrderCreateInput>, 'mutationFn'>) => { const qc = useQueryClient(); return useMutation({ ...o, mutationFn: api.createTransformationOrder, retry: false as const, onSuccess: async (d,v,c,mc) => { await Promise.all([qc.invalidateQueries({ queryKey: k.transformationOrderLists() }), qc.invalidateQueries({ queryKey: k.order(v.productionOrderId) })]); await o?.onSuccess?.(d,v,c,mc); } }); };
export const useCloseTransformationOrder = (o?: Omit<UseMutationOptions<Awaited<ReturnType<typeof api.closeTransformationOrder>>, Error, string>, 'mutationFn'>) => { const qc = useQueryClient(); return useMutation({ ...o, mutationFn: api.closeTransformationOrder, retry: false as const, onSuccess: async (d,v,c,mc) => { await Promise.all([qc.invalidateQueries({ queryKey: k.transformationOrderLists() }), qc.invalidateQueries({ queryKey: k.transformationOrder(v) }), qc.invalidateQueries({ queryKey: k.order(d.productionOrderId) })]); await o?.onSuccess?.(d,v,c,mc); } }); };
function customMutation<T, V>(fn: (v: V) => Promise<T>, o?: Omit<UseMutationOptions<T, Error, V>, 'mutationFn'>) {
  const qc = useQueryClient();
  return useMutation({ ...o, mutationFn: fn, retry: false as const, onSuccess: async (d, v, c, mc) => {
    await qc.invalidateQueries({ queryKey: k.customFieldDefinitions() });
    await o?.onSuccess?.(d, v, c, mc);
  }});
}
export const useCreateCustomFieldDefinition = (o?: Omit<UseMutationOptions<Awaited<ReturnType<typeof api.createCustomFieldDefinition>>, Error, CustomFieldDefinitionCreateInput>, 'mutationFn'>) => customMutation(api.createCustomFieldDefinition, o);
export const useUpdateCustomFieldDefinition = (o?: Omit<UseMutationOptions<Awaited<ReturnType<typeof api.updateCustomFieldDefinition>>, Error, { id: string; input: CustomFieldDefinitionUpdateInput }>, 'mutationFn'>) => customMutation(v => api.updateCustomFieldDefinition(v.id, v.input), o);
export const useActivateCustomFieldDefinition = (o?: Omit<UseMutationOptions<Awaited<ReturnType<typeof api.activateCustomFieldDefinition>>, Error, string>, 'mutationFn'>) => customMutation(api.activateCustomFieldDefinition, o);
export const useDeactivateCustomFieldDefinition = (o?: Omit<UseMutationOptions<Awaited<ReturnType<typeof api.deactivateCustomFieldDefinition>>, Error, string>, 'mutationFn'>) => customMutation(api.deactivateCustomFieldDefinition, o);
export const useUpsertCustomFieldValue = (o?: Omit<UseMutationOptions<Awaited<ReturnType<typeof api.upsertCustomFieldValue>>, Error, CustomFieldValueInput>, 'mutationFn'>) => {
  const qc = useQueryClient();
  return useMutation({ ...o, mutationFn: api.upsertCustomFieldValue, retry: false as const, onSuccess: async (d, v, c, mc) => {
    const invalidations = [qc.invalidateQueries({ queryKey: k.customFieldValues() })];
    if (v.entityType === 'GRAPE_RECEPTION') {
      invalidations.push(qc.invalidateQueries({ queryKey: k.reception(v.entityId) }));
    }
    await Promise.all(invalidations);
    await o?.onSuccess?.(d, v, c, mc);
  }});
};

export const useGrapeReceptions = (f: ReceptionListFilters = {}, o?: Q<Awaited<ReturnType<typeof api.getGrapeReceptions>>>) => query(k.receptionList(f), s => api.getGrapeReceptions(f, s), o);
export const useGrapeReception = (id: string, o?: Q<Awaited<ReturnType<typeof api.getGrapeReception>>>) => query(k.reception(id), s => api.getGrapeReception(id, s), o, false);
export const useProductionBatches = (f: BatchListFilters = {}, o?: Q<Awaited<ReturnType<typeof api.getProductionBatches>>>) => query(k.batchList(f), s => api.getProductionBatches(f, s), o);
async function loadAllPages<T>(load: (page: number, signal: AbortSignal) => Promise<{ data: T[]; meta: { totalPages: number } }>, signal: AbortSignal) {
  const first = await load(1, signal);
  const pages = await Promise.all(Array.from({ length: Math.max(0, first.meta.totalPages - 1) }, (_, index) => load(index + 2, signal)));
  return [first, ...pages].flatMap(page => page.data);
}
export const useAllProductionBatches = (o?: Q<ProductionBatch[]>) =>
  query([...k.batchLists(), 'all'], signal => loadAllPages((page, currentSignal) => api.getProductionBatches({ page, pageSize: 100 }, currentSignal), signal), o, false);
export const useProductionBatch = (id: string, o?: Q<Awaited<ReturnType<typeof api.getProductionBatch>>>) => query(k.batch(id), s => api.getProductionBatch(id, s), o, false);
export const useProductionBatchBalance = (id: string, o?: Q<Awaited<ReturnType<typeof api.getProductionBatchBalance>>>) => query(k.batchBalance(id), s => api.getProductionBatchBalance(id, s), o, false);
export const useProductionBatchTrace = (id: string, o?: Q<Awaited<ReturnType<typeof api.getProductionBatchTrace>>>) => query(k.batchTrace(id), s => api.getProductionBatchTrace(id, s), o, false);

export const useCreateGrapeReception = (o?: Omit<UseMutationOptions<Awaited<ReturnType<typeof api.createGrapeReception>>, Error, GrapeReceptionCreateInput>, 'mutationFn'>) => {
  const qc = useQueryClient();
  return useMutation({ ...o, mutationFn: api.createGrapeReception, retry: false as const, onSuccess: async (d, v, c, mc) => {
    await Promise.all([qc.invalidateQueries({ queryKey: k.receptionLists() }), qc.invalidateQueries({ queryKey: k.batchLists() })]);
    await o?.onSuccess?.(d, v, c, mc);
  }});
};
export const useCorrectGrapeReception = (o?: Omit<UseMutationOptions<Awaited<ReturnType<typeof api.correctGrapeReception>>, Error, { id: string; input: ReceptionCorrectionInput }>, 'mutationFn'>) => {
  const qc = useQueryClient();
  return useMutation({ ...o, mutationFn: v => api.correctGrapeReception(v.id, v.input), retry: false as const, onSuccess: async (d, v, c, mc) => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: k.receptionLists() }),
      qc.invalidateQueries({ queryKey: k.reception(v.id) }),
      qc.invalidateQueries({ queryKey: ['production', 'trace'] }),
    ]);
    await o?.onSuccess?.(d, v, c, mc);
  }});
};

export const useProductionContainers = (o?: Q<Awaited<ReturnType<typeof api.getProductionContainers>>>) => query(k.containers(), s => api.getProductionContainers(s), o, false);
export const useProductionContainer = (id: string, o?: Q<Awaited<ReturnType<typeof api.getProductionContainer>>>) => query(k.container(id), s => api.getProductionContainer(id, s), o, false);
export const useProductionContainerOccupancies = (id: string, o?: Q<Awaited<ReturnType<typeof api.getProductionContainerOccupancies>>>) => query([...k.container(id), 'occupancies'], s => api.getProductionContainerOccupancies(id, s), o, false);
export const useProductionContainerMovements = (id: string, o?: Q<Awaited<ReturnType<typeof api.getProductionContainerMovements>>>) => query([...k.container(id), 'movements'], s => api.getProductionContainerMovements(id, s), o, false);

export const useCreateProductionContainer = (o?: Omit<UseMutationOptions<Awaited<ReturnType<typeof api.createProductionContainer>>, Error, import('../types/production.types').ContainerCreateInput>, 'mutationFn'>) => {
  const qc = useQueryClient();
  return useMutation({ ...o, mutationFn: api.createProductionContainer, retry: false as const, onSuccess: async (d, v, c, mc) => { await qc.invalidateQueries({ queryKey: k.containers() }); await o?.onSuccess?.(d, v, c, mc); } });
};
export const useUpdateProductionContainer = (o?: Omit<UseMutationOptions<Awaited<ReturnType<typeof api.updateProductionContainer>>, Error, { id: string; input: import('../types/production.types').ContainerUpdateInput }>, 'mutationFn'>) => {
  const qc = useQueryClient();
  return useMutation({ ...o, mutationFn: v => api.updateProductionContainer(v.id, v.input), retry: false as const, onSuccess: async (d, v, c, mc) => { await Promise.all([qc.invalidateQueries({ queryKey: k.containers() }), qc.invalidateQueries({ queryKey: k.container(v.id) })]); await o?.onSuccess?.(d, v, c, mc); } });
};
export const useActivateProductionContainer = (o?: Omit<UseMutationOptions<Awaited<ReturnType<typeof api.activateProductionContainer>>, Error, string>, 'mutationFn'>) => {
  const qc = useQueryClient();
  return useMutation({ ...o, mutationFn: api.activateProductionContainer, retry: false as const, onSuccess: async (d, v, c, mc) => { await Promise.all([qc.invalidateQueries({ queryKey: k.containers() }), qc.invalidateQueries({ queryKey: k.container(v) })]); await o?.onSuccess?.(d, v, c, mc); } });
};
export const useDeactivateProductionContainer = (o?: Omit<UseMutationOptions<Awaited<ReturnType<typeof api.deactivateProductionContainer>>, Error, string>, 'mutationFn'>) => {
  const qc = useQueryClient();
  return useMutation({ ...o, mutationFn: api.deactivateProductionContainer, retry: false as const, onSuccess: async (d, v, c, mc) => { await Promise.all([qc.invalidateQueries({ queryKey: k.containers() }), qc.invalidateQueries({ queryKey: k.container(v) })]); await o?.onSuccess?.(d, v, c, mc); } });
};

export const useAssignProductionContainer = (o?: Omit<UseMutationOptions<Awaited<ReturnType<typeof api.assignProductionContainer>>, Error, { id: string; input: import('../types/production.types').ContainerAssignInput }>, 'mutationFn'>) => {
  const qc = useQueryClient();
  return useMutation({
    ...o,
    mutationFn: v => api.assignProductionContainer(v.id, v.input),
    retry: false as const,
    onSuccess: async (d, v, c, mc) => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: k.containers() }),
        qc.invalidateQueries({ queryKey: k.container(v.id) }),
        qc.invalidateQueries({ queryKey: [...k.container(v.id), 'occupancies'] }),
        qc.invalidateQueries({ queryKey: [...k.container(v.id), 'movements'] }),
        qc.invalidateQueries({ queryKey: k.batch(v.input.batchId) }),
        qc.invalidateQueries({ queryKey: k.batchBalance(v.input.batchId) }),
        qc.invalidateQueries({ queryKey: k.batchLists() }),
        qc.invalidateQueries({ queryKey: ['production', 'trace'] })
      ]);
      await o?.onSuccess?.(d, v, c, mc);
    }
  });
};

export const useTransferProductionContainerTotal = (o?: Omit<UseMutationOptions<Awaited<ReturnType<typeof api.transferProductionContainerTotal>>, Error, { sourceId: string; input: import('../types/production.types').ContainerTransferTotalInput }>, 'mutationFn'>) => {
  const qc = useQueryClient();
  return useMutation({
    ...o,
    mutationFn: v => api.transferProductionContainerTotal(v.sourceId, v.input),
    retry: false as const,
    onSuccess: async (d, v, c, mc) => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: k.containers() }),
        qc.invalidateQueries({ queryKey: k.container(v.sourceId) }),
        qc.invalidateQueries({ queryKey: [...k.container(v.sourceId), 'occupancies'] }),
        qc.invalidateQueries({ queryKey: [...k.container(v.sourceId), 'movements'] }),
        qc.invalidateQueries({ queryKey: k.container(v.input.destinationContainerId) }),
        qc.invalidateQueries({ queryKey: [...k.container(v.input.destinationContainerId), 'occupancies'] }),
        qc.invalidateQueries({ queryKey: [...k.container(v.input.destinationContainerId), 'movements'] }),
        qc.invalidateQueries({ queryKey: k.batch(v.input.batchId) }),
        qc.invalidateQueries({ queryKey: k.batchBalance(v.input.batchId) }),
        qc.invalidateQueries({ queryKey: k.batchLists() }),
        qc.invalidateQueries({ queryKey: ['production', 'trace'] })
      ]);
      await o?.onSuccess?.(d, v, c, mc);
    }
  });
};

export const useTransferProductionContainerPartial = (o?: Omit<UseMutationOptions<Awaited<ReturnType<typeof api.transferProductionContainerPartial>>, Error, { sourceId: string; input: import('../types/production.types').ContainerTransferPartialInput }>, 'mutationFn'>) => {
  const qc = useQueryClient();
  return useMutation({
    ...o,
    mutationFn: v => api.transferProductionContainerPartial(v.sourceId, v.input),
    retry: false as const,
    onSuccess: async (d, v, c, mc) => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: k.containers() }),
        qc.invalidateQueries({ queryKey: k.container(v.sourceId) }),
        qc.invalidateQueries({ queryKey: [...k.container(v.sourceId), 'occupancies'] }),
        qc.invalidateQueries({ queryKey: [...k.container(v.sourceId), 'movements'] }),
        qc.invalidateQueries({ queryKey: k.container(v.input.destinationContainerId) }),
        qc.invalidateQueries({ queryKey: [...k.container(v.input.destinationContainerId), 'occupancies'] }),
        qc.invalidateQueries({ queryKey: [...k.container(v.input.destinationContainerId), 'movements'] }),
        qc.invalidateQueries({ queryKey: k.batch(v.input.batchId) }),
        qc.invalidateQueries({ queryKey: k.batchBalance(v.input.batchId) }),
        qc.invalidateQueries({ queryKey: k.batchLists() }),
        qc.invalidateQueries({ queryKey: ['production', 'trace'] })
      ]);
      await o?.onSuccess?.(d, v, c, mc);
    }
  });
};

export const useProductionWorks = (f: WorkListFilters = {}, o?: Q<Awaited<ReturnType<typeof api.getProductionWorks>>>) => query(k.workList(f), s => api.getProductionWorks(f, s), o);
export const useAllProductionWorks = (o?: Q<ProductionWork[]>) =>
  query([...k.workLists(), 'all'], signal => loadAllPages((page, currentSignal) => api.getProductionWorks({ page, pageSize: 100 }, currentSignal), signal), o, false);
export const useProductionWork = (id: string, o?: Q<Awaited<ReturnType<typeof api.getProductionWork>>>) => query(k.work(id), s => api.getProductionWork(id, s), o, false);
export const useProductionMeasurements = (f: MeasurementListFilters = {}, o?: Q<Awaited<ReturnType<typeof api.getProductionMeasurements>>>) => query(k.measurementList(f), s => api.getProductionMeasurements(f, s), o);
export const useProductionMeasurement = (id: string, o?: Q<Awaited<ReturnType<typeof api.getProductionMeasurement>>>) => query(k.measurement(id), s => api.getProductionMeasurement(id, s), o, false);
export const useCreateProductionWork = (o?: Omit<UseMutationOptions<Awaited<ReturnType<typeof api.createProductionWork>>, Error, ProductionWorkCreateInput>, 'mutationFn'>) => {
  const qc = useQueryClient();
  return useMutation({ ...o, mutationFn: api.createProductionWork, retry: false as const, onSuccess: async (d, v, c, mc) => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: k.workLists() }),
      qc.invalidateQueries({ queryKey: ['production', 'trace'] }),
    ]);
    await o?.onSuccess?.(d, v, c, mc);
  } });
};
export const useCorrectProductionWork = (o?: Omit<UseMutationOptions<Awaited<ReturnType<typeof api.correctProductionWork>>, Error, { id: string; input: WorkCorrectionInput }>, 'mutationFn'>) => {
  const qc = useQueryClient();
  return useMutation({ ...o, mutationFn: v => api.correctProductionWork(v.id, v.input), retry: false as const, onSuccess: async (d, v, c, mc) => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: k.workLists() }),
      qc.invalidateQueries({ queryKey: k.work(v.id) }),
      qc.invalidateQueries({ queryKey: ['production', 'trace'] }),
    ]);
    await o?.onSuccess?.(d, v, c, mc);
  } });
};
export const useCreateProductionWorkInput = (o?: Omit<UseMutationOptions<Awaited<ReturnType<typeof api.createProductionWorkInput>>, Error, { workId: string; input: import('../types/production.types').WorkInputCreateInput }>, 'mutationFn'>) => {
  const qc = useQueryClient();
  return useMutation({
    ...o,
    mutationFn: v => api.createProductionWorkInput(v.workId, v.input),
    retry: false as const,
    onSuccess: async (d, v, c, mc) => {
      const p = [
        qc.invalidateQueries({ queryKey: k.workLists() }),
        qc.invalidateQueries({ queryKey: k.work(v.workId) }),
        qc.invalidateQueries({ queryKey: ['production', 'trace'] }),
        qc.invalidateQueries({ predicate: (query) => {
          const key = query.queryKey;
          if (key[0] !== 'inventory' || (key[1] !== 'stock' && key[1] !== 'available')) return false;
          return key.slice(2).some((part: any) => part?.warehouseId === v.input.warehouseId && part?.articuloId === v.input.articuloId);
        } }),
        qc.invalidateQueries({ queryKey: [...inventoryKeys.movements(), v.input.articuloId] }),
      ];
      if (v.input.inventoryLotId) {
        p.push(qc.invalidateQueries({ queryKey: inventoryKeys.lot(v.input.inventoryLotId) }));
      }
      await Promise.all(p);
      await o?.onSuccess?.(d, v, c, mc);
    }
  });
};
export const useReverseProductionWorkInput = (o?: Omit<UseMutationOptions<Awaited<ReturnType<typeof api.reverseProductionWorkInput>>, Error, { workId: string; inputId: string; articuloId: string; warehouseId: string; inventoryLotId: string | null; input: import('../types/production.types').WorkInputReverseInput }>, 'mutationFn'>) => {
  const qc = useQueryClient();
  return useMutation({
    ...o,
    mutationFn: v => api.reverseProductionWorkInput(v.workId, v.inputId, v.input),
    retry: false as const,
    onSuccess: async (d, v, c, mc) => {
      const p = [
        qc.invalidateQueries({ queryKey: k.workLists() }),
        qc.invalidateQueries({ queryKey: k.work(v.workId) }),
        qc.invalidateQueries({ queryKey: ['production', 'trace'] }),
        qc.invalidateQueries({ predicate: (query) => {
          const key = query.queryKey;
          if (key[0] !== 'inventory' || (key[1] !== 'stock' && key[1] !== 'available')) return false;
          return key.slice(2).some((part: any) => part?.warehouseId === v.warehouseId && part?.articuloId === v.articuloId);
        } }),
        qc.invalidateQueries({ queryKey: [...inventoryKeys.movements(), v.articuloId] }),
      ];
      if (v.inventoryLotId) {
        p.push(qc.invalidateQueries({ queryKey: inventoryKeys.lot(v.inventoryLotId) }));
      }
      await Promise.all(p);
      await o?.onSuccess?.(d, v, c, mc);
    }
  });
};
export const useCreateProductionMeasurement = (o?: Omit<UseMutationOptions<Awaited<ReturnType<typeof api.createProductionMeasurement>>, Error, ProductionMeasurementCreateInput>, 'mutationFn'>) => {
  const qc = useQueryClient();
  return useMutation({ ...o, mutationFn: api.createProductionMeasurement, retry: false as const, onSuccess: async (d, v, c, mc) => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: k.measurementLists() }),
      qc.invalidateQueries({ queryKey: ['production', 'trace'] }),
    ]);
    await o?.onSuccess?.(d, v, c, mc);
  } });
};
export const useCorrectProductionMeasurement = (o?: Omit<UseMutationOptions<Awaited<ReturnType<typeof api.correctProductionMeasurement>>, Error, { id: string; input: MeasurementCorrectionInput }>, 'mutationFn'>) => {
  const qc = useQueryClient();
  return useMutation({ ...o, mutationFn: v => api.correctProductionMeasurement(v.id, v.input), retry: false as const, onSuccess: async (d, v, c, mc) => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: k.measurementLists() }),
      qc.invalidateQueries({ queryKey: k.measurement(v.id) }),
      qc.invalidateQueries({ queryKey: ['production', 'trace'] }),
    ]);
    await o?.onSuccess?.(d, v, c, mc);
  } });
};

export const useTransformations = (f: TransformationListFilters = {}, o?: Q<Awaited<ReturnType<typeof api.getTransformations>>>) => query(k.transformationList(f), s => api.getTransformations(f, s), o);
export const useTransformation = (id: string, o?: Q<Awaited<ReturnType<typeof api.getTransformation>>>) => query(k.transformationDetail(id), s => api.getTransformation(id, s), o, false);
export const useCreateTransformation = (o?: Omit<UseMutationOptions<Awaited<ReturnType<typeof api.createTransformation>>, Error, TransformationCreateInput>, 'mutationFn'>) => {
  const qc = useQueryClient();
  return useMutation({
    ...o,
    mutationFn: api.createTransformation,
    retry: false as const,
    onSuccess: async (d, v, c, mc) => {
      const invalidations: Promise<void>[] = [
        qc.invalidateQueries({ queryKey: k.transformationLists() }),
        qc.invalidateQueries({ queryKey: k.transformationDetail(d.id) }),
        qc.invalidateQueries({ queryKey: k.batchLists() })
      ];

      const affectedExistingBatchIds = new Set([
        ...v.inputs.map(i => i.productionBatchId),
        ...(v.losses ?? []).flatMap(loss => loss.productionBatchId ? [loss.productionBatchId] : []),
      ]);
      affectedExistingBatchIds.forEach(id => {
        invalidations.push(qc.invalidateQueries({ queryKey: k.batch(id) }));
        invalidations.push(qc.invalidateQueries({ queryKey: k.batchBalance(id) }));
        invalidations.push(qc.invalidateQueries({ queryKey: k.batchTrace(id) }));
      });

      const outputBatchIds = new Set(d.outputs.map(out => out.productionBatchId));
      outputBatchIds.forEach(id => {
        invalidations.push(qc.invalidateQueries({ queryKey: k.batch(id) }));
        invalidations.push(qc.invalidateQueries({ queryKey: k.batchBalance(id) }));
        invalidations.push(qc.invalidateQueries({ queryKey: k.batchTrace(id) }));
      });

      if (v.productionWorkId) {
        invalidations.push(qc.invalidateQueries({ queryKey: k.workLists() }));
        invalidations.push(qc.invalidateQueries({ queryKey: k.work(v.productionWorkId) }));
      }

      await Promise.all(invalidations);
      await o?.onSuccess?.(d, v, c, mc);
    }
  });
};
export function useInventoryReleaseWarehouses(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: k.inventoryReleaseWarehouses(),
    queryFn: ({ signal }) => api.listInventoryReleaseWarehouses(signal),
    staleTime: 5 * 60 * 1000, enabled: options?.enabled,
  });
}

export function useBatchReleases(batchId: string) {
  return useQuery({
    queryKey: k.batchReleases(batchId),
    queryFn: ({ signal }) => api.listBatchReleases(batchId, signal),
  });
}


export function useReleaseBatchToInventory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { batchId: string; input: ReleaseBatchInput; context: { articuloId: string } }) =>
      api.releaseBatchToInventory(params.batchId, params.input),
    retry: false,
    onSuccess: async (res, variables) => {
      const data = res.data;
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: k.batch(variables.batchId) }),
        queryClient.invalidateQueries({ queryKey: k.batchBalance(variables.batchId) }),
        queryClient.invalidateQueries({ queryKey: k.batchTrace(variables.batchId) }),
        queryClient.invalidateQueries({ queryKey: k.batchLists() }),
        queryClient.invalidateQueries({ queryKey: k.batchReleases(variables.batchId) }),

        queryClient.invalidateQueries({ queryKey: inventoryKeys.stockValue({ warehouseId: data.warehouseId, articuloId: variables.context.articuloId, inventoryLotId: data.inventoryLotId }) }),
        queryClient.invalidateQueries({ queryKey: inventoryKeys.availableValue({ warehouseId: data.warehouseId, articuloId: variables.context.articuloId, inventoryLotId: data.inventoryLotId }) }),
        queryClient.invalidateQueries({ queryKey: inventoryKeys.stockValue({ warehouseId: data.warehouseId, articuloId: variables.context.articuloId }) }),
        queryClient.invalidateQueries({ queryKey: inventoryKeys.availableValue({ warehouseId: data.warehouseId, articuloId: variables.context.articuloId }) }),
        queryClient.invalidateQueries({ queryKey: inventoryKeys.lot(data.inventoryLotId) }),
        queryClient.invalidateQueries({
          predicate: (query) => {
            const key = query.queryKey;
            if (key[0] !== 'inventory' || key[1] !== 'movements') return false;

            const articuloId = key[2];
            if (articuloId !== variables.context.articuloId) return false;

            const filters = key[3] as any;
            if (filters && typeof filters === 'object') {
              if (filters.warehouseId && filters.warehouseId !== data.warehouseId) return false;
              if (filters.inventoryLotId && filters.inventoryLotId !== data.inventoryLotId) return false;
              if (filters.type && filters.type !== 'INBOUND') return false;
            }
            return true;
          }
        }),
      ]);
    }
  });
}


export function useReverseBatchRelease() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { batchId: string; releaseId: string; input: ReverseReleaseInput; context: { warehouseId: string; articuloId: string; inventoryLotId: string } }) =>
      api.reverseBatchRelease(params.batchId, params.releaseId, params.input),
    retry: false,
    onSuccess: async (_, variables) => {
      const { warehouseId, articuloId, inventoryLotId } = variables.context;
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: k.batch(variables.batchId) }),
        queryClient.invalidateQueries({ queryKey: k.batchBalance(variables.batchId) }),
        queryClient.invalidateQueries({ queryKey: k.batchTrace(variables.batchId) }),
        queryClient.invalidateQueries({ queryKey: k.batchLists() }),
        queryClient.invalidateQueries({ queryKey: k.batchReleases(variables.batchId) }),

        queryClient.invalidateQueries({ queryKey: inventoryKeys.stockValue({ warehouseId, articuloId, inventoryLotId }) }),
        queryClient.invalidateQueries({ queryKey: inventoryKeys.availableValue({ warehouseId, articuloId, inventoryLotId }) }),
        queryClient.invalidateQueries({ queryKey: inventoryKeys.stockValue({ warehouseId, articuloId }) }),
        queryClient.invalidateQueries({ queryKey: inventoryKeys.availableValue({ warehouseId, articuloId }) }),
        queryClient.invalidateQueries({ queryKey: inventoryKeys.lot(inventoryLotId) }),
        queryClient.invalidateQueries({
          predicate: (query) => {
            const key = query.queryKey;
            if (key[0] !== 'inventory' || key[1] !== 'movements') return false;

            const reqArticuloId = key[2];
            if (reqArticuloId !== articuloId) return false;

            const filters = key[3] as any;
            if (filters && typeof filters === 'object') {
              if (filters.warehouseId && filters.warehouseId !== warehouseId) return false;
              if (filters.inventoryLotId && filters.inventoryLotId !== inventoryLotId) return false;
              if (filters.type && filters.type !== 'OUTBOUND') return false;
            }
            return true;
          }
        }),
      ]);
    }
  });
}
