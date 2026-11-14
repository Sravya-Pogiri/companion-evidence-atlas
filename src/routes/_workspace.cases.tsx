import {createFileRoute} from '@tanstack/react-router';
import {CaseTriage} from '@/components/caselens/case-triage';
import {seo} from '@/lib/seo';
export const Route=createFileRoute('/_workspace/cases')({head:()=>seo('My Cases — Priority triage','Court dates, filing deadlines, and open evidence work ranked by transparent urgency scores.'),component:CaseTriage});
