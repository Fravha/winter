import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CatalogList } from './CatalogList';
import { CustomFieldDefinitionList } from './CustomFieldDefinitionList';
import {
  useParticipants, useCreateParticipant, useUpdateParticipant, useActivateParticipant, useDeactivateParticipant,
  useProducers, useCreateProducer, useUpdateProducer, useActivateProducer, useDeactivateProducer,
  useGrapeVarieties, useCreateGrapeVariety, useUpdateGrapeVariety, useActivateGrapeVariety, useDeactivateGrapeVariety,
  useWorkTypes, useCreateWorkType, useUpdateWorkType, useActivateWorkType, useDeactivateWorkType,
  useMeasurementTypes, useCreateMeasurementType, useUpdateMeasurementType, useActivateMeasurementType, useDeactivateMeasurementType
} from '../../api/production.hooks';

export function CatalogsView() {
  return (
    <Tabs defaultValue="participants" className="w-full">
      <div className="w-full overflow-x-auto pb-2 scrollbar-none">
        <TabsList className="mb-2 min-w-max">
          <TabsTrigger value="participants" data-testid="tab-catalog-participants">Participantes</TabsTrigger>
          <TabsTrigger value="producers" data-testid="tab-catalog-producers">Productores</TabsTrigger>
          <TabsTrigger value="grapeVarieties" data-testid="tab-catalog-grape-varieties">Variedades</TabsTrigger>
          <TabsTrigger value="workTypes" data-testid="tab-catalog-work-types">Tipos de trabajo</TabsTrigger>
          <TabsTrigger value="measurementTypes" data-testid="tab-catalog-measurement-types">Tipos de medición</TabsTrigger>
          <TabsTrigger value="customFields" data-testid="tab-catalog-custom-fields">Campos personalizados</TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="participants" className="mt-0 focus-visible:outline-none">
        <CatalogList
          title="Participantes"
          managePermission="production:participant_manage"
          useList={useParticipants}
          useCreate={useCreateParticipant}
          useUpdate={useUpdateParticipant}
          useActivate={useActivateParticipant}
          useDeactivate={useDeactivateParticipant}
          hasUserId={true}
        />
      </TabsContent>
      <TabsContent value="producers" className="mt-0 focus-visible:outline-none">
        <CatalogList
          title="Productores"
          managePermission="production:producer_manage"
          useList={useProducers}
          useCreate={useCreateProducer}
          useUpdate={useUpdateProducer}
          useActivate={useActivateProducer}
          useDeactivate={useDeactivateProducer}
        />
      </TabsContent>
      <TabsContent value="grapeVarieties" className="mt-0 focus-visible:outline-none">
        <CatalogList
          title="Variedades de uva"
          managePermission="production:grape_variety_manage"
          useList={useGrapeVarieties}
          useCreate={useCreateGrapeVariety}
          useUpdate={useUpdateGrapeVariety}
          useActivate={useActivateGrapeVariety}
          useDeactivate={useDeactivateGrapeVariety}
        />
      </TabsContent>
      <TabsContent value="workTypes" className="mt-0 focus-visible:outline-none">
        <CatalogList
          title="Tipos de trabajo"
          managePermission="production:work_type_manage"
          useList={useWorkTypes}
          useCreate={useCreateWorkType}
          useUpdate={useUpdateWorkType}
          useActivate={useActivateWorkType}
          useDeactivate={useDeactivateWorkType}
        />
      </TabsContent>
      <TabsContent value="measurementTypes" className="mt-0 focus-visible:outline-none">
        <CatalogList
          title="Tipos de medición"
          managePermission="production:measurement_type_manage"
          useList={useMeasurementTypes}
          useCreate={useCreateMeasurementType}
          useUpdate={useUpdateMeasurementType}
          useActivate={useActivateMeasurementType}
          useDeactivate={useDeactivateMeasurementType}
        />
      </TabsContent>
      <TabsContent value="customFields" className="mt-0 focus-visible:outline-none">
        <CustomFieldDefinitionList />
      </TabsContent>
    </Tabs>
  );
}
