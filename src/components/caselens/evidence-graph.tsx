import { useCallback, useEffect, useMemo, useState } from "react";
import { Background, Controls, Handle, Position, ReactFlow, applyNodeChanges, BaseEdge, EdgeLabelRenderer, getBezierPath, type Edge, type Node, type NodeChange, type NodeProps, type EdgeProps, type ReactFlowInstance } from "@xyflow/react";
import { FileText, User, Shield, MapPin, Zap, Package, MessageSquare, AlertTriangle, Eye, Play, AudioLines } from "lucide-react";
import { graphEdges, graphNodes, relColor, type GEdgeData, type GNodeData, type NodeKind } from "@/lib/graph-data";
import { reviewPositions, reviewNotes } from "@/lib/review-data";
import { cn } from "@/lib/utils";

export const kindMeta: Record<NodeKind, { icon: typeof User; label: string; color: string }> = {
  person: { icon: User, label: "Person", color: "var(--gold)" }, witness: { icon: Eye, label: "Witness", color: "var(--corroborate)" }, officer: { icon: Shield, label: "Officer", color: "var(--related)" }, document: { icon: FileText, label: "Document", color: "var(--foreground)" }, location: { icon: MapPin, label: "Location", color: "var(--graph-location)" }, event: { icon: Zap, label: "Event", color: "var(--contradiction)" }, object: { icon: Package, label: "Object", color: "var(--graph-object)" }, statement: { icon: MessageSquare, label: "Statement", color: "var(--corroborate)" }, missing: { icon: AlertTriangle, label: "Missing", color: "var(--missing)" },
};
type ND = GNodeData & { dim?: boolean; dark?: boolean };
function EvidenceNode({ data, selected }: NodeProps<Node<ND>>) {
  const M = kindMeta[data.kind]; const doc = data.kind === "document"; const missing = data.kind === "missing";
  return <div className={cn("graph-entity", `graph-kind-${data.kind}`, selected && "graph-selected", data.dim && "graph-dim")}>
    <Handle type="target" position={Position.Top} className="graph-handle" />
    {doc ? <><div className={cn("graph-source-thumb", (data.label.endsWith(".mp4")||data.label.includes("YouTube")) ? "graph-video-thumb" : data.label.endsWith(".mp3") ? "graph-audio-thumb" : "graph-paper-thumb")}>{(data.label.endsWith(".mp4")||data.label.includes("YouTube")) ? <Play /> : data.label.endsWith(".mp3") ? <AudioLines /> : <><FileText /><i/><i/><i/></>}</div><span>{data.label}</span></> : missing ? <><div className="graph-missing-thumb">?</div><span>{data.label} — not established</span></> : <><div className="graph-node-icon"><M.icon /></div><span>{data.label}</span></>}
    <Handle type="source" position={Position.Bottom} className="graph-handle" />
  </div>;
}
function ReviewEdge(props: EdgeProps<Edge<GEdgeData>>) {
  const rel = props.data?.rel ?? "related"; const note = reviewNotes.find(n => n.edgeId === props.id);
  const [path,x,y] = getBezierPath({...props, curvature: props.id === "x2" ? .65 : .3});
  return <><BaseEdge id={props.id} path={path} style={props.style} interactionWidth={22} className={cn("review-graph-edge", `graph-edge-${rel}`)} />{note && rel === "contradiction" && <EdgeLabelRenderer><div className="graph-edge-label nodrag nopan" style={{transform:`translate(-50%, -50%) translate(${x}px,${y}px)`, opacity: props.style?.opacity}}>{note.label}</div></EdgeLabelRenderer>}<title>{props.data?.source}</title></>;
}
const nodeTypes = { evidence: EvidenceNode }; const edgeTypes = { review: ReviewEdge };
export type GraphSelection = { type: "node"; data: GNodeData } | { type: "edge"; data: GEdgeData; from: string; to: string; id: string } | null;
export function EvidenceGraph({ compact = false, dark = false, query = "", hidden = new Set<NodeKind>(), onSelect, focusEdge, guided = false }: { compact?: boolean; dark?: boolean; query?: string; hidden?: Set<NodeKind>; onSelect?: (s: GraphSelection) => void; focusEdge?: string | null; guided?: boolean }) {
  const [nodes,setNodes] = useState<Node<ND>[]>(()=>graphNodes.map(n=>({...n,position:reviewPositions[n.id] ?? n.position})));
  const [hover,setHover] = useState<string | null>(null); const [flow,setFlow] = useState<ReactFlowInstance<Node<ND>,Edge<GEdgeData>> | null>(null);
  const onNodesChange = useCallback((c: NodeChange<Node<ND>>[])=>setNodes(n=>applyNodeChanges(c,n)),[]);
  const focus = graphEdges.find(e=>e.id===focusEdge);
  const bright = useMemo(()=>{ if (hover) return new Set([hover,...graphEdges.filter(e=>e.source===hover||e.target===hover).flatMap(e=>[e.source,e.target])]); if (focus && guided) return new Set([focus.source,focus.target]); return null; },[hover,focus,guided]);
  const q = query.trim().toLowerCase();
  const viewNodes = nodes.filter(n=>!hidden.has(n.data.kind)).map(n=>({...n, selected: focus?.source===n.id||focus?.target===n.id, data:{...n.data,dark,dim:(bright ? !bright.has(n.id) : false)||(q!==""&&!n.data.label.toLowerCase().includes(q))}}));
  const ids = new Set(viewNodes.map(n=>n.id));
  const edges: Edge<GEdgeData>[] = graphEdges.filter(e=>ids.has(e.source)&&ids.has(e.target)).map(e=>{ const rel=e.data?.rel ?? "related"; const dim=hover ? e.source!==hover&&e.target!==hover : guided&&focus ? e.id!==focus.id : false; return {...e,animated:false,type:"review",style:{stroke:rel==="related" ? "var(--graph-related)" : relColor[rel],strokeWidth:rel==="contradiction" ? 3 : rel==="missing" ? 2 : 1,strokeDasharray:rel==="missing" ? "7 5" : undefined,opacity:dim ? .15 : rel==="related" ? .35 : rel==="corroborate" ? .6 : 1},className:focus?.id===e.id ? "graph-focus-edge" : ""}; });
  useEffect(()=>{ if(!flow||!focus) return; const visible=nodes.filter(n=>(n.id===focus.source||n.id===focus.target)&&!hidden.has(n.data.kind)); if(visible.length) void flow.fitView({nodes:visible,padding:.65,duration:window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 700,maxZoom:1.1}); },[flow,focus,nodes,hidden]);
  return <ReactFlow nodes={viewNodes} edges={edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes} onInit={setFlow} onNodesChange={onNodesChange} fitView fitViewOptions={{padding:.18}} minZoom={.2} maxZoom={1.8} proOptions={{hideAttribution:true}} panOnScroll={!compact} zoomOnScroll={!compact} colorMode={dark ? "dark" : "light"} onNodeMouseEnter={(_,n)=>setHover(n.id)} onNodeMouseLeave={()=>setHover(null)} onNodeClick={(_,n)=>onSelect?.({type:"node",data:n.data})} onEdgeClick={(_,e)=>{if(e.data)onSelect?.({type:"edge",data:e.data,from:nodes.find(n=>n.id===e.source)?.data.label ?? e.source,to:nodes.find(n=>n.id===e.target)?.data.label ?? e.target,id:e.id});}} onPaneClick={()=>onSelect?.(null)}><Background gap={32} size={1} color="var(--border)"/>{!compact&&<Controls position="bottom-left" showInteractive={false}/>}</ReactFlow>;
}
export function GraphLegend({ dark = false }: { dark?: boolean }) { return <div className={cn("flex gap-3 text-xs", dark ? "text-ivory/70" : "text-muted-foreground")}>{(["related","corroborate","contradiction","missing"] as const).map(k=><span key={k}>{k}</span>)}</div>; }
