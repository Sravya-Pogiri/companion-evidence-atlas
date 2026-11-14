import {createFileRoute} from '@tanstack/react-router';
import {DefenseNotebook} from '@/components/caselens/defense-notebook';
import {seo} from '@/lib/seo';
export const Route=createFileRoute('/_workspace/assistant')({head:()=>seo('Defense prep — Trial notebook','Source-linked case summaries, editable cross-examination questions, discovery requests, and attorney-review drafts.'),component:DefenseNotebook});
