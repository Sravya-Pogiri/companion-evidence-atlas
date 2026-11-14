import { z } from 'zod';
export const scenarioIds=['conflicting','matching','incomplete'] as const;
export type ScenarioId=typeof scenarioIds[number];
export const citationSchema=z.object({sourceId:z.enum(['report','video','transcript','dispatch']),page:z.number().nullable(),start:z.number().nullable(),end:z.number().nullable(),rowId:z.string().nullable()});
export type Citation=z.infer<typeof citationSchema>;
export const checkSchema=z.object({tool:z.string(),status:z.enum(['completed','failed']),result:z.string(),references:z.array(citationSchema)});
export const investigationSchema=z.object({caseId:z.enum(scenarioIds),runId:z.string().nullable(),outcome:z.enum(['Possible discrepancy','Records agree on this claim','Insufficient evidence']),explanation:z.string(),gaps:z.array(z.string()),citations:z.array(citationSchema),checks:z.array(checkSchema)});
export type Investigation=z.infer<typeof investigationSchema>;
