import { Link } from "@tanstack/react-router";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { cases } from "@/lib/case-data";

export function CasesTable() {
  return (
    <Table>
      <TableHeader><TableRow><TableHead>Case</TableHead><TableHead>Case ID</TableHead><TableHead>Sources</TableHead><TableHead>Open question</TableHead><TableHead>Type</TableHead></TableRow></TableHeader>
      <TableBody>
        {cases.map((c) => (
          <TableRow key={c.id}>
            <TableCell className="font-medium"><Link to={c.to} className="hover:underline">{c.name}</Link></TableCell>
            <TableCell className="font-mono text-xs text-muted-foreground">{c.id}</TableCell>
            <TableCell>{c.sources} sources</TableCell>
            <TableCell className="text-sm text-muted-foreground">{c.question}</TableCell>
            <TableCell><Badge variant="outline">{c.status}</Badge></TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
