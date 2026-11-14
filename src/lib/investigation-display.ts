export function conciseCheck(text:string):string {
 try {const value=JSON.parse(text);
  if(value.observation)return `Sampled ${value.sampledAt.join(', ')} seconds. ${value.observation}`;
  if(value.covered!==undefined)return `Requested ${value.requested.start}–${value.requested.end}s. Recording covers ${value.available.start}–${value.available.end}s. ${value.covered?'The interval is available.':'The required lead-up is missing.'}`;
  if(Array.isArray(value.segments))return value.segments.length ? value.segments.map((s:{start:number;end:number;text:string})=>`${s.start}–${s.end}s: ${s.text}`).join('\n') : `No matching earlier exchange in the available transcript (coverage ${value.coverage.start}–${value.coverage.end}s).`;
  if(value.id&&value.time)return `${value.id} · ${value.time}\n${value.text}`;
 }catch{}
 return text;
}
