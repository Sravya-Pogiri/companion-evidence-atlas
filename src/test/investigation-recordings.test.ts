import { describe,it,expect } from 'vitest';
import { recordedInvestigations } from '@/lib/investigation-recordings';
describe('Real recorded investigations',()=>{
 it('full conflicting sequence returns only a possible discrepancy',()=>expect(recordedInvestigations.conflicting.outcome).toBe('Possible discrepancy'));
 it('earlier request resolves the matching sequence',()=>expect(recordedInvestigations.matching.outcome).toBe('Records agree on this claim'));
 it('incomplete recording cannot produce a confirmed discrepancy',()=>expect(recordedInvestigations.incomplete.outcome).toBe('Insufficient evidence'));
 it('every visible citation came from an actual completed tool',()=>Object.values(recordedInvestigations).forEach(run=>{const refs=run.checks.filter(c=>c.status==='completed').flatMap(c=>c.references).map(r=>JSON.stringify(r));run.citations.forEach(c=>expect(refs).toContain(JSON.stringify(c)));}));
});
