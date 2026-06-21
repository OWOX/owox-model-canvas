import { useCallback, useEffect, useSyncExternalStore, useState } from "react";
import type { FC } from "react";
import {
  ReactFlow as ReactFlowBase,
  Background,
  BackgroundVariant,
  Controls,
  ConnectionMode,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type NodeChange,
  type Connection,
  type ReactFlowProps,
  useReactFlow,
  ReactFlowProvider,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import "./canvas.css";

import dagre from "@dagrejs/dagre";
import { X } from "lucide-react";

import { createModelStore } from "../../state/model";
import { loadPersistedGraph, persistGraph } from "../../state/persist";
import { loadViewMode, persistViewMode, type ViewMode } from "../../state/viewMode";
import type { ModelNode, ModelEdge, ModelGraph } from "@mc/okf";

import { graphToBundleFiles, downloadBundle } from "../../okf/io";
import { pushModel, type PushResult } from "../../sync/push";

import { api } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { TopBar, type StorageOption } from "../TopBar";
import { ImportDialog } from "../ImportDialog";
import { LibraryDialog } from "../LibraryDialog";
import { SignInModal } from "../SignInModal";
import { pushIntent } from "../../sync/pushGate";
import { Dock, type Tool } from "./Dock";
import { MartNode } from "./MartNode";
import { RelEdge } from "./RelEdge";
import { buildRfEdges, isEdgeReconnectable } from "./edges";
import { erdAwareNodeSize } from "./layoutSize";
import { Inspector } from "../inspector/Inspector";

// Cast to FC to avoid generic component JSX typing issues with @types/react 18.3
const ReactFlow = ReactFlowBase as unknown as FC<ReactFlowProps>;

// ── store singleton (exported so external modules can share this instance) ───
// Rehydrate from localStorage so a refresh doesn't wipe the in-session model.
export const store = createModelStore(loadPersistedGraph());

// ── helpers to convert between model and RF types ───────────────────────────
function toRFNode(n: ModelNode, viewMode: ViewMode): Node {
  return {
    id: n.key,
    type: "mart",
    position: n.position,
    data: { ...n, _viewMode: viewMode } as unknown as Record<string, unknown>,
  };
}

// ── Dagre auto-layout ────────────────────────────────────────────────────────
const NODE_W = 200;
const NODE_H = 90;

function runDagreLayout(nodes: ModelNode[], edges: ModelEdge[], viewMode: ViewMode): Map<string, { x: number; y: number }> {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "LR", nodesep: 60, ranksep: 150 });
  nodes.forEach(n => { const s = erdAwareNodeSize(n, viewMode); g.setNode(n.key, { width: s.width, height: s.height }); });
  edges.forEach(e => g.setEdge(e.from, e.to));
  dagre.layout(g);
  const positions = new Map<string, { x: number; y: number }>();
  nodes.forEach(n => {
    const pos = g.node(n.key);
    const s = erdAwareNodeSize(n, viewMode);
    positions.set(n.key, { x: pos.x - s.width / 2, y: pos.y - s.height / 2 });
  });
  return positions;
}

// ── Selection types ──────────────────────────────────────────────────────────
type Selection =
  | { type: "node"; id: string }
  | { type: "edge"; id: string }
  | null;

// ── Inner canvas (needs ReactFlowProvider context) ────────────────────────────
const nodeTypes = { mart: MartNode };
const edgeTypes = { rel: RelEdge };

function CanvasInner() {
  const graph = useSyncExternalStore(store.subscribe, store.get);
  const { screenToFlowPosition } = useReactFlow();

  const [selection, setSelection] = useState<Selection>(null);
  const [tool, setTool] = useState<Tool>("select");
  const [viewMode, setViewMode] = useState<ViewMode>(loadViewMode());
  const [showImport, setShowImport] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [pushResult, setPushResult] = useState<PushResult | null>(null);
  const [storages, setStorages] = useState<StorageOption[]>([]);
  const [signIn, setSignIn] = useState<{ mode: "connect" | "push" } | null>(null);
  const { me, connect, signOut } = useAuth();

  // Load the project's storages once signed in; retry through OWOX's transient
  // 500s. Anonymous users have no session, so we skip the call entirely and
  // clear any stale list.
  const loadStorages = useCallback(async (): Promise<StorageOption[]> => {
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        const list = await api<StorageOption[]>("/api/storages");
        setStorages(list);
        if (!store.get().storageId && list[0]) store.set({ ...store.get(), storageId: list[0].id });
        return list;
      } catch {
        await new Promise(r => setTimeout(r, 1200));
      }
    }
    return [];
  }, []);

  useEffect(() => {
    if (!me) { setStorages([]); return; }
    void loadStorages();
  }, [me, loadStorages]);

  const handleStorageChange = useCallback((id: string) => { store.set({ ...store.get(), storageId: id }); }, []);

  // React Flow owns the live node/edge arrays so dragging follows the cursor
  // smoothly (RF applies position changes frame-by-frame). The model store stays
  // the source of truth: we sync store → RF on structural/data changes, and write
  // positions back to the store only at drag end.
  const [rfNodes, setRfNodes, onRfNodesChange] = useNodesState<Node>([]);
  const [rfEdges, setRfEdges, onRfEdgesChange] = useEdgesState<Edge>([]);

  useEffect(() => { setRfNodes(graph.nodes.map(n => toRFNode(n, viewMode))); }, [graph.nodes, viewMode, setRfNodes]);
  useEffect(() => { setRfEdges(buildRfEdges(graph.edges, graph.nodes, viewMode)); }, [graph.edges, graph.nodes, viewMode, setRfEdges]);

  // Mark only the selected relationship as reconnectable so dragging an endpoint
  // moves the line the user picked (not whichever overlapping edge RF would grab).
  // Patches `reconnectable` in place — never touches `selected` — and re-applies
  // after any rebuild of the edges array above.
  useEffect(() => {
    const selId = selection?.type === "edge" ? selection.id : null;
    setRfEdges(eds => eds.map(e => {
      const want = isEdgeReconnectable((e.data as { modelEdgeId?: string } | undefined)?.modelEdgeId, selId, viewMode);
      return e.reconnectable === want ? e : { ...e, reconnectable: want };
    }));
  }, [selection, viewMode, graph.edges, graph.nodes, setRfEdges]);

  // Mirror the model to localStorage on every change so a refresh/crash doesn't
  // lose work (Push to OWOX remains the real save).
  useEffect(() => { persistGraph(graph); }, [graph]);

  // Warn before leaving while there's unpushed work — the model lives in the
  // session and may not all be in OWOX yet.
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (!store.get().nodes.some(n => n.status !== "created")) return;
      e.preventDefault();
      e.returnValue = ""; // required for Chrome to show the native prompt
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    onRfNodesChange(changes);                       // animate the drag live
    for (const c of changes) {
      if (c.type === "position" && c.position && c.dragging === false) {
        store.updateNode(c.id, { position: c.position }); // persist final position
      }
    }
  }, [onRfNodesChange]);

  // ── Connect handler ────────────────────────────────────────────────────────
  // Drag an existing edge end onto another port/node to re-route it (for a tidy picture).
  const onReconnect = useCallback((oldEdge: Edge, conn: Connection) => {
    // ERD view is display-only: its edges carry synthetic "<modelEdgeId>::<n>"
    // ids (one per join key) that don't map 1:1 to a model edge, so
    // store.updateEdge(oldEdge.id, …) would match nothing and silently no-op.
    // Disable reconnection entirely in this mode rather than ship that no-op.
    if (viewMode === "erd") return;
    if (!conn.source || !conn.target || conn.source === conn.target) return;
    store.updateEdge(oldEdge.id, {
      from: conn.source, to: conn.target,
      sourceHandle: conn.sourceHandle, targetHandle: conn.targetHandle,
    });
  }, [viewMode]);

  const onConnect = useCallback((connection: Connection) => {
    if (!connection.source || !connection.target) return;
    // Open the new edge in the inspector right away so the user can set join
    // keys without an extra click to select the freshly-drawn line.
    const e = store.addEdge(connection.source, connection.target, connection.sourceHandle, connection.targetHandle);
    if (e) setSelection({ type: "edge", id: e.id });
  }, []);

  // ── Pane click → add (in Add tool) or deselect ────────────────────────────
  const onPaneClick = useCallback((e: React.MouseEvent) => {
    if (tool === "add") {
      const pos = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      const n = store.addNode({ x: pos.x - NODE_W / 2, y: pos.y - NODE_H / 2 });
      setSelection({ type: "node", id: n.key });
      setTool("select");
      return;
    }
    setSelection(null);
  }, [tool, screenToFlowPosition]);

  // ── Node click → select ────────────────────────────────────────────────────
  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelection({ type: "node", id: node.id });
  }, []);

  // ── Edge click → select ────────────────────────────────────────────────────
  // ERD mode may render several RF edges per model edge (e.g. "e1::0"); strip
  // the suffix so the inspector still selects the underlying model edge.
  // Invariant: model edge ids are generated as "e<n>" and never contain "::",
  // so this split is a safe no-op in compact mode (plain ids pass through unchanged).
  const onEdgeClick = useCallback((_: React.MouseEvent, edge: Edge) => {
    setSelection({ type: "edge", id: edge.id.split("::")[0] });
  }, []);

  // ── Auto-layout + tool handler ─────────────────────────────────────────────
  // Read the graph from the store at call time so this stays stable and doesn't
  // re-create (and churn the Dock keydown listener) on every drag-move tick.
  const handleToolChange = useCallback((t: Tool) => {
    if (t === "layout") {
      const { nodes, edges } = store.get();
      const positions = runDagreLayout(nodes, edges, viewMode);
      positions.forEach((pos, key) => store.updateNode(key, { position: pos }));
      return;
    }
    setTool(t);
  }, [viewMode]);

  const handleToggleView = useCallback(() => {
    setViewMode(prev => {
      const next = prev === "erd" ? "compact" : "erd";
      persistViewMode(next);
      return next;
    });
  }, []);

  // ── Keyboard delete ────────────────────────────────────────────────────────
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if ((e.key === "Delete" || e.key === "Backspace") && selection) {
      const tag = (e.target as HTMLElement).tagName;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(tag)) return;
      if (selection.type === "node") store.removeNode(selection.id);
      else store.removeEdge(selection.id);
      setSelection(null);
    }
  }, [selection]);

  // ── Double-click on empty pane → add node (works in any tool, like the prototype) ──
  const handleWrapperDoubleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    // Only fire when clicking the pane (not on a node card or edge)
    const target = e.target as HTMLElement;
    if (target.closest(".react-flow__node") || target.closest(".react-flow__edge")) return;
    const position = screenToFlowPosition({ x: e.clientX, y: e.clientY });
    const n = store.addNode({ x: position.x - NODE_W / 2, y: position.y - NODE_H / 2 });
    setSelection({ type: "node", id: n.key });
    setTool("select");
  }, [screenToFlowPosition]);

  // ── Import / Export / Push handlers ───────────────────────────────────────
  const handleExport = useCallback(() => {
    const title = me?.projectTitle ?? "model-okf";
    const files = graphToBundleFiles(store.get(), title);
    downloadBundle(files, title);
  }, [me]);

  // Auto-layout a freshly loaded graph (import or template). The OKF format does
  // not persist node positions (Dagre re-lays out on load, by design), so without
  // this every imported node piles up at the origin and must be dragged apart.
  const withLayout = useCallback((g: ModelGraph): ModelGraph => {
    const positions = runDagreLayout(g.nodes, g.edges, viewMode);
    return { ...g, nodes: g.nodes.map(n => ({ ...n, position: positions.get(n.key) ?? n.position })) };
  }, [viewMode]);

  const handleImportConfirm = useCallback((g: ModelGraph) => {
    store.set(withLayout(g));
    setShowImport(false);
  }, [withLayout]);

  const handleUseTemplate = useCallback((g: ModelGraph) => {
    // Keep the model on the currently selected storage; auto-layout the template.
    store.set({ ...withLayout(g), storageId: store.get().storageId });
    setShowLibrary(false);
  }, [withLayout]);

  const runPush = useCallback(async (storagesList: StorageOption[] = storages) => {
    setPushResult(null);
    setPushing(true);
    try {
      const storageType = storagesList.find(s => s.id === store.get().storageId)?.type;
      const result = await pushModel(store, undefined, storageType);
      setPushResult(result);
    } catch (e) {
      setPushResult({ created: 0, updated: 0, failed: 0, relationshipsCreated: 0, relationshipsFailed: 0, errors: [(e as Error).message] });
    } finally {
      setPushing(false);
    }
  }, [storages]);

  const handlePush = useCallback(() => {
    if (pushIntent(me) === "sign-in") { setSignIn({ mode: "push" }); return; }
    void runPush();
  }, [me, runPush]);

  // ── Pending count for TopBar ───────────────────────────────────────────────
  const pendingCount = graph.nodes.filter(n => n.status === "pending").length;

  // ── Canvas class based on tool ─────────────────────────────────────────────
  const canvasClass =
    tool === "add" ? "canvas-add" :
    tool === "connect" ? "canvas-connect" : "";

  return (
    <div
      className="flex flex-col h-screen overflow-hidden bg-[#f7f8fa]"
      style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, system-ui, sans-serif" }}
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      <TopBar
        pendingCount={pendingCount}
        storages={storages}
        storageId={graph.storageId}
        onStorageChange={handleStorageChange}
        onImport={() => setShowImport(true)}
        onExport={handleExport}
        onPush={handlePush}
        onLibrary={() => setShowLibrary(true)}
        signedIn={!!me}
        projectTitle={me?.projectTitle}
        onSignIn={() => setSignIn({ mode: "connect" })}
        onSignOut={() => { void signOut(); }}
      />
      {pushing && (
        <div className="fixed bottom-4 right-4 z-50 bg-slate-900 text-white text-[13px] px-4 py-2 rounded-lg shadow-lg">
          Pushing to OWOX…
        </div>
      )}
      {!pushing && pushResult && (
        <PushToast result={pushResult} onClose={() => setPushResult(null)} />
      )}
      {showImport && (
        <ImportDialog
          onConfirm={handleImportConfirm}
          onClose={() => setShowImport(false)}
        />
      )}
      {showLibrary && (
        <LibraryDialog
          onUse={handleUseTemplate}
          onClose={() => setShowLibrary(false)}
        />
      )}
      {signIn && (
        <SignInModal
          mode={signIn.mode}
          connect={connect}
          onConnected={async () => {
            const mode = signIn.mode;
            setSignIn(null);
            const list = await loadStorages();
            if (mode === "push") {
              if (list.length === 0) {
                setPushResult({ created: 0, updated: 0, failed: 0, relationshipsCreated: 0, relationshipsFailed: 0, errors: ["Couldn't load your OWOX storages — please try Push again."] });
                return;
              }
              await runPush(list);
            }
          }}
          onClose={() => setSignIn(null)}
        />
      )}

      <div className="flex flex-1 min-h-0 relative">
        {/* Left tool dock */}
        <Dock activeTool={tool} onToolChange={handleToolChange} viewMode={viewMode} onToggleView={handleToggleView} />

        {/* React Flow canvas */}
        <div
          className={`flex-1 relative ${canvasClass}`}
          onDoubleClick={handleWrapperDoubleClick}
        >
          <ReactFlow
            nodes={rfNodes}
            edges={rfEdges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onRfEdgesChange}
            onConnect={onConnect}
            onReconnect={onReconnect}
            edgesReconnectable={false}
            onPaneClick={onPaneClick}
            onNodeClick={onNodeClick}
            onEdgeClick={onEdgeClick}
            connectionMode={ConnectionMode.Loose}
            fitView={false}
            minZoom={0.4}
            maxZoom={1.6}
            nodesDraggable={tool === "select"}
            nodesConnectable={true}
            selectNodesOnDrag={false}
            panOnDrag={tool === "select"}
            zoomOnScroll={true}
            zoomOnDoubleClick={false}
            deleteKeyCode={null}
          >
            <Background variant={BackgroundVariant.Dots} gap={22} size={1.3} color="#e2e6ec" />
            <Controls />
          </ReactFlow>

          {/* Empty canvas CTA */}
          {graph.nodes.length === 0 && (
            <div
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center text-slate-500 pointer-events-none z-[1]"
              style={{ fontSize: 15 }}
            >
              <div><strong className="text-slate-900">Empty canvas</strong></div>
              <div className="mt-[6px] text-[13px] leading-[1.6]">
                Double-click anywhere to add an object.<br />
                Drag from a node's port to create a relationship.
              </div>
            </div>
          )}
        </div>

        {/* Right inspector drawer */}
        <Inspector
          selection={selection}
          nodes={graph.nodes}
          edges={graph.edges}
          onUpdateNode={store.updateNode}
          onUpdateEdge={store.updateEdge}
          onClose={() => setSelection(null)}
        />
      </div>
    </div>
  );
}

// ── Push result toast (sticky — dismissed by the user, not on a timer) ─────────
function PushToast({ result, onClose }: { result: PushResult; onClose: () => void }) {
  const hasFailures = result.failed > 0 || result.relationshipsFailed > 0;
  const summary = `${result.created} mart${result.created === 1 ? "" : "s"} created`
    + (result.relationshipsCreated ? `, ${result.relationshipsCreated} link${result.relationshipsCreated === 1 ? "" : "s"} created` : "")
    + (hasFailures ? `, ${result.failed + result.relationshipsFailed} failed` : "");
  return (
    <div className={`fixed bottom-4 right-4 z-50 w-[420px] max-h-[60vh] overflow-y-auto rounded-xl shadow-2xl border text-[13px] ${hasFailures ? "bg-white border-red-300" : "bg-white border-emerald-300"}`}>
      <div className="flex items-start gap-2 px-4 py-3 border-b border-slate-100">
        <span className={`mt-[2px] h-2 w-2 rounded-full flex-shrink-0 ${hasFailures ? "bg-red-500" : "bg-emerald-500"}`} />
        <div className="flex-1 font-semibold text-slate-800">
          {hasFailures ? "Push completed with errors" : "Push complete"}
          <div className="font-normal text-slate-500 text-[12px] mt-0.5">{summary}</div>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-700" title="Dismiss"><X size={16} /></button>
      </div>
      {result.errors.length > 0 && (
        <ul className="px-4 py-2 flex flex-col gap-1.5">
          {result.errors.map((err, i) => (
            <li key={i} className="text-[12px] text-red-600 leading-snug break-words font-mono">{err}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Public export ─────────────────────────────────────────────────────────────
export function CanvasApp() {
  return (
    <ReactFlowProvider>
      <CanvasInner />
    </ReactFlowProvider>
  );
}
