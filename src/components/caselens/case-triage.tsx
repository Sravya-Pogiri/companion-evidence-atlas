import {Link} from '@tanstack/react-router';
import {ArrowRight,Scale} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {cases,type CaseRecord} from '@/lib/case-data';

function CaseCard({c}:{c:CaseRecord}){
 return <article className="triage-card urgency-track"><div className="flex items-center justify-between gap-2"><span className="font-mono text-xs text-muted-foreground">{c.id}</span><span className="urgency-label">{c.status}</span></div><h3>{c.name}</h3><p className="text-sm text-muted-foreground">{c.summary}</p><h4>Open question</h4><p className="text-sm">{c.question}</p><p className="text-xs text-muted-foreground">{c.sources} sources</p><Button asChild className="mt-auto"><Link to={c.to}>{c.cta}<ArrowRight/></Link></Button></article>;
}
export function CaseTriage(){
 const real=cases.filter(c=>c.kind==='public-record');
 return <div className="triage-page"><header className="triage-heading"><div><h1>My Cases</h1><p>Real public-record cases only. New cases are added one at a time.</p></div></header>
 <section><h2 className="flex items-center gap-2"><Scale className="size-4"/>Public record</h2><div className="triage-cards">{real.map(c=><CaseCard key={c.id} c={c}/>)}</div></section>
 <p className="text-xs text-muted-foreground mt-5">Findings are potential and require attorney verification. Staged cases use synthetic evidence.</p></div>;
}
