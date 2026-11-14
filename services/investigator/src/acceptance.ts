import { investigate } from './investigate.ts';
for(const id of ['conflicting','matching','incomplete']) {
 try {const output=await investigate(id,c=>console.log(id,c.tool,c.status));console.log('OUTCOME',id,output.outcome,output.explanation);}catch(e){console.error('FAILED',id,e);process.exitCode=1;break;}
}
