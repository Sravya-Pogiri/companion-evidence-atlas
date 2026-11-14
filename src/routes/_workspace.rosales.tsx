import {useState} from 'react';
import {createFileRoute} from '@tanstack/react-router';
import {ExternalLink,FileText,Video,Eye,CheckCircle2,HelpCircle} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {seo} from '@/lib/seo';

export const Route=createFileRoute('/_workspace/rosales')({head:()=>seo('Rosales v. Terrell — Public-record walkthrough','Officer statement, bodycam and dashcam footage, and the Fifth Circuit opinion side by side.'),component:Rosales});

const COMPLAINT='https://ij.org/wp-content/uploads/2022/10/LA-Rosales-Traffic-Stop-Complaint.pdf#page=24';
const OPINION='https://www.govinfo.gov/content/pkg/USCOURTS-ca5-25-30650/pdf/USCOURTS-ca5-25-30650-0.pdf#page=11';
const videos={bodycam:{label:'Officer bodycam',id:'Z6z35SUVpdQ',url:'https://www.youtube.com/watch?v=Z6z35SUVpdQ&t=45s'},dashcam:{label:'Dashcam',id:'xqvFJ8yzDfw',url:'https://www.youtube.com/watch?v=xqvFJ8yzDfw&t=45s'}} as const;

function Rosales(){
 const [cam,setCam]=useState<keyof typeof videos>('dashcam');const [reveal,setReveal]=useState(false);const v=videos[cam];
 return <div className="space-y-6">
  <header><p className="font-mono text-xs text-muted-foreground">5th Cir. No. 25-30650 · Alexandria, Louisiana · 2022 traffic stop</p><h1 className="font-serif text-3xl">Rosales v. Terrell</h1><p className="text-sm text-muted-foreground">Public-record walkthrough. Footage plays from YouTube, so CaseLens shows it beside the record rather than analyzing the files. Use a staged case to see the analysis run live.</p></header>
  <div className="grid gap-4 lg:grid-cols-2">
   <section className="rounded-lg border bg-card p-5"><h2 className="flex items-center gap-2 font-serif text-xl"><FileText className="size-4"/>Officer’s stated reason</h2><p className="mt-1 font-mono text-xs text-muted-foreground">Filed complaint · p. 24, ¶ 208</p>
    <blockquote className="mt-4 border-l-2 border-primary pl-4 text-sm leading-relaxed">Mario asked: “So, can you be honest with me? Why am I being stopped?” (¶ 207)<br/><br/>Officer Terrell responded, “<mark className="bg-primary/25 text-foreground">Failure to signal.</mark> That’s straight, pure and straight honest answer. You failed to signal, so we stopped you.”</blockquote>
    <p className="mt-3 text-xs text-muted-foreground">As alleged in the complaint.</p>
    <Button asChild variant="outline" size="sm" className="mt-4"><a href={COMPLAINT} target="_blank" rel="noreferrer">Open complaint, p. 24 <ExternalLink/></a></Button></section>
   <section className="rounded-lg border bg-card p-5"><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="flex items-center gap-2 font-serif text-xl"><Video className="size-4"/>The turn</h2><div className="flex gap-1">{(Object.keys(videos) as (keyof typeof videos)[]).map(k=><Button key={k} size="sm" variant={cam===k?'secondary':'ghost'} aria-pressed={cam===k} onClick={()=>setCam(k)}>{videos[k].label}</Button>)}</div></div>
    <p className="mt-1 font-mono text-xs text-muted-foreground">Starts at 0:45 · Mustang approaches the intersection and turns left</p>
    <div className="mt-4 aspect-video overflow-hidden rounded-md border"><iframe key={v.id} className="size-full" src={`https://www.youtube-nocookie.com/embed/${v.id}?start=45`} title={`${v.label} — Rosales traffic stop`} allow="encrypted-media; picture-in-picture" allowFullScreen/></div>
    <a href={v.url} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:underline">Open on YouTube <ExternalLink className="size-3"/></a></section>
  </div>
  <div className="grid gap-4 md:grid-cols-2">
   <article className="rounded-lg border border-primary/40 bg-card p-5"><h3 className="flex items-center gap-2 font-serif text-lg"><CheckCircle2 className="size-4 text-primary"/>Signal visible before turn</h3><p className="mt-2 text-sm text-muted-foreground">Potential finding: in the footage, the Mustang’s left signal is already on when its lights come into view, before it turns. This sits in tension with the stated reason, “failure to signal.”</p></article>
   <article className="rounded-lg border bg-card p-5"><h3 className="flex items-center gap-2 font-serif text-lg"><HelpCircle className="size-4"/>Activation point unresolved</h3><p className="mt-2 text-sm text-muted-foreground">The footage does not show when the signal was turned on, so it cannot establish whether it was on at least 100 feet before the turn. CaseLens leaves this open rather than guessing.</p></article>
  </div>
  <section className="rounded-lg border bg-card p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-serif text-xl">Independent check</h2><p className="text-sm text-muted-foreground">Compare the two findings with the Fifth Circuit’s reading of the same video.</p></div>{!reveal&&<Button onClick={()=>setReveal(true)}><Eye/>Reveal court opinion</Button>}</div>
   {reveal&&<div className="mt-4"><p className="font-mono text-xs text-muted-foreground">Fifth Circuit opinion · No. 25-30650 · p. 11</p><blockquote className="mt-3 border-l-2 border-primary pl-4 text-sm leading-relaxed">“It shows Officers pull behind the Mustang as it approached an intersection, and <mark className="bg-primary/25 text-foreground">the left turn signal was already activated as the Mustang’s lights come into view.</mark> <mark className="bg-primary/25 text-foreground">It is not clear from the video when Rosales activated the signal</mark>—i.e., whether it was activated at least one hundred feet before the turn.”</blockquote>
    <p className="mt-3 text-xs text-muted-foreground">The court draws the same distinction: signal visible, activation point unclear.</p>
    <Button asChild variant="outline" size="sm" className="mt-4"><a href={OPINION} target="_blank" rel="noreferrer">Open opinion, p. 11 <ExternalLink/></a></Button></div>}</section>
  <p className="text-xs text-muted-foreground">Findings are potential and require attorney verification.</p>
 </div>;
}
