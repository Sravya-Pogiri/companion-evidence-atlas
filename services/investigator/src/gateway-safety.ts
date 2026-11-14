import { readFile,writeFile,mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
const statePath=resolve(import.meta.dirname,'../runs/gateway-paused.json');
export class InvestigationError extends Error {constructor(message:string,public retryable=false,public status=500){super(message);}}
export async function checkGatewayPause(){try{const state=JSON.parse(await readFile(statePath,'utf8'));throw new InvestigationError(state.message,false,state.status);}catch(e){if(e instanceof InvestigationError)throw e;if((e as {code?:string}).code!=='ENOENT')throw e;}}
export function safeGatewayFetch(baseFetch:typeof fetch):typeof fetch {return async(input,init)=>{
 const response=await baseFetch(input,init);
 if([400,401,402,403,404,429].includes(response.status)||response.status>=500){
  let message=`AI service returned ${response.status}.`;try{const body=await response.clone().json();const candidate=body?.error?.message??body?.message;if(typeof candidate==='string')message=candidate;}catch{}
  if([402,403,404].includes(response.status)){await mkdir(resolve(import.meta.dirname,'../runs'),{recursive:true});await writeFile(statePath,JSON.stringify({status:response.status,message}));}
  // Do not retry automatically. Owner remedies required for terminal statuses; explicit retry allowed for transient errors only.
  throw new InvestigationError(message,response.status===429||response.status>=500,response.status);
 }
 return response;
};}
export function safeError(error:unknown){if(error instanceof InvestigationError)return {message:error.message,retryable:error.retryable};return {message:'An evidence check could not be completed. Retry the investigation; no outcome has been confirmed.',retryable:true};}
