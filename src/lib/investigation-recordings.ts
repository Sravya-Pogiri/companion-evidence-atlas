import conflicting from './investigation-runs/conflicting.json';
import matching from './investigation-runs/matching.json';
import incomplete from './investigation-runs/incomplete.json';
import { investigationSchema } from './investigation-types';
export const recordedInvestigations={conflicting:investigationSchema.parse(conflicting),matching:investigationSchema.parse(matching),incomplete:investigationSchema.parse(incomplete)};
