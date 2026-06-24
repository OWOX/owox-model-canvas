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
import { X, Sparkles } from "lucide-react";

import { createModelStore } from "../../state/model";
import { loadPersistedGraph, persistGraph } from "../../state/persist";
import { loadViewMode, persistViewMode, type ViewMode } from "../../state/viewMode";
import type { ModelNode, ModelEdge, ModelGraph } from "@mc/okf";

import { graphToBundleFiles, downloadBundle } from "../../okf/io";
import { buildShareUrl, readSharedModel, clearSharedModelFromUrl } from "../../share/url";
import { exportCanvasSvg } from "../../share/exportImage";
import { pushModel, pushPreview, type PushResult } from "../../sync/push";
import { detachFromOwox } from "../../sync/detach";

import { api } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { TopBar, type StorageOption } from "../TopBar";
import { ImportDialog } from "../ImportDialog";
import { OwoxImportDialog } from "../OwoxImportDialog";
import { mergeGraphs } from "../../sync/owoxImport";
import { LibraryDialog } from "../LibraryDialog";
import { TemplateApplyDialog } from "../TemplateApplyDialog";
import { WelcomeDialog } from "../WelcomeDialog";
import { SignInModal } from "../SignInModal";
import { PushConfirmDialog } from "../PushConfirmDialog";
import { pushIntent } from "../../sync/pushGate";
import { reconcileStorageId } from "../../sync/storageReconcile";
import { Dock, type Tool } from "./Dock";
import { MartNode } from "./MartNode";
import { RelEdge } from "./RelEdge";
import { buildRfEdges, isEdgeReconnectable } from "./edges";
import { erdAwareNodeSize } from "./layoutSize";
import { Inspector } from "../inspector/Inspector";
import { GoalDialog } from "../GoalDialog";
import { loadGoal, persistGoal, type BusinessGoal } from "../../state/goal";

// Cast to FC to avoid generic component JSX typing issues with @types/react 18.3
const ReactFlow = ReactFlowBase as unknown as FC<ReactFlowProps>;

// ── store singleton (exported so external modules can share this instance) ───
// A shared link (#m=…) wins over localStorage: opening it reopens that exact
// model. Otherwise rehydrate from localStorage so a refresh doesn't wipe work.
const sharedGraph = readSharedModel();
const persistedGraph = loadPersistedGraph();
export const store = createModelStore(sharedGraph ?? persistedGraph);
if (sharedGraph) {
  // Persist the opened model right away — it's the store's initial value, so it
  // never fires a change that the mirror-to-localStorage effect would catch; a
  // refresh would otherwise lose it once the hash is cleared.
  persistGraph(store.get());
  // Drop the payload from the address bar so a refresh doesn't re-clobber the
  // canvas and the URL stays clean.
  clearSharedModelFromUrl();
}

// A truly first-ever visit has no persisted model and no shared link. Captured at
// module load — before the persist effect writes an (empty) graph — so it stays
// true for the session. Gates the first-screen "start" chooser: shown once for
// new visitors, never over a returning user's model or an opened shared link.
const isFirstVisit = !sharedGraph && persistedGraph === undefined;

// Map a loaded template (by its display name) to the closest Insight-Questions
// niche, so opening the Business Goal dialog after a template can pre-pick it.
const TEMPLATE_NICHE: Record<string, string> = {
  "E-commerce / Retail": "E-commerce / Retail",
  "SaaS / Subscription": "SaaS / Subscription",
  "Marketplace": "Marketplace / Platform",
  "Marketing / Lead-gen": "B2B Marketing / Lead-gen",
  "Mobile / Gaming": "Mobile App / Gaming",
  "Finance / Fintech": "Fintech / Lending",
  "Healthcare": "Healthcare Provider",
};

// ── helpers to convert between model and RF types ───────────────────────────
function toRFNode(n: ModelNode, viewMode: ViewMode, keyFields?: string[]): Node {
  return {
    id: n.key,
    type: "mart",
    position: n.position,
    data: { ...n, _viewMode: viewMode, _keyFields: keyFields } as unknown as Record<string, unknown>,
  };
}

// Field names involved in a relationship, per node key — so the ERD node can keep
// its join keys visible even when it collapses the rest of its fields behind the
// expand toggle (edges anchor to those field handles).
function keyFieldsByNode(edges: ModelEdge[]): Map<string, Set<string>> {
  const m = new Map<string, Set<string>>();
  const add = (key: string, field?: string) => {
    if (!field) return;
    (m.get(key) ?? m.set(key, new Set()).get(key)!).add(field);
  };
  for (const e of edges) for (const k of e.keys) { add(e.from, k.left); add(e.to, k.right); }
  return m;
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
  const { screenToFlowPosition, fitView } = useReactFlow();
  // True briefly during auto-layout so nodes glide (CSS transition) to their new
  // positions instead of snapping.
  const [layoutAnimating, setLayoutAnimating] = useState(false);

  const [selection, setSelection] = useState<Selection>(null);
  const [goal, setGoalState] = useState<BusinessGoal | null>(loadGoal());
  const [showGoal, setShowGoal] = useState(false);
  // Niche guessed from the last template loaded — pre-fills the Business Goal
  // dialog. And a session flag so the Insight-Questions hero prompt is dismissable.
  const [suggestedNiche, setSuggestedNiche] = useState<string | null>(null);
  const [heroDismissed, setHeroDismissed] = useState(false);
  // Server tells us whether the Insight Questions feature is on (GEMINI_API_KEY
  // set). Gates the Business Goal button so the feature is a pure env switch.
  const [questionsEnabled, setQuestionsEnabled] = useState(false);
  useEffect(() => {
    api<{ questionsEnabled: boolean }>("/api/config")
      .then(c => setQuestionsEnabled(!!c.questionsEnabled))
      .catch(() => setQuestionsEnabled(false));
  }, []);
  const [tool, setTool] = useState<Tool>("select");
  const [viewMode, setViewMode] = useState<ViewMode>(loadViewMode());
  const [showImport, setShowImport] = useState(false);
  const [showOwoxImport, setShowOwoxImport] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  // A template chosen from the library while the canvas already had content —
  // held until the user confirms Replace vs Merge in the TemplateApplyDialog.
  const [pendingTemplate, setPendingTemplate] = useState<{ graph: ModelGraph; name: string } | null>(null);
  // First-screen chooser — shown once to brand-new visitors (no persisted model).
  const [showWelcome, setShowWelcome] = useState(isFirstVisit);
  const [pushing, setPushing] = useState(false);
  const [pushResult, setPushResult] = useState<PushResult | null>(null);
  const [shareToast, setShareToast] = useState<string | null>(null);
  const [storages, setStorages] = useState<StorageOption[]>([]);
  const [signIn, setSignIn] = useState<{ mode: "connect" | "push" } | null>(null);
  const [showPushConfirm, setShowPushConfirm] = useState(false);
  const { me, connect, signOut } = useAuth();

  // Load the project's storages once signed in; retry through OWOX's transient
  // 500s. Anonymous users have no session, so we skip the call entirely and
  // clear any stale list.
  const loadStorages = useCallback(async (): Promise<StorageOption[]> => {
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        const list = await api<StorageOption[]>("/api/storages");
        setStorages(list);
        // Keep the current storage only if it's still in this project; otherwise
        // fall back to the first available so we never push to a stale storage
        // (e.g. after signing into a different project).
        const reconciled = reconcileStorageId(store.get().storageId, list);
        if (reconciled !== store.get().storageId) store.set({ ...store.get(), storageId: reconciled });
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

  useEffect(() => {
    const kf = keyFieldsByNode(graph.edges);
    setRfNodes(graph.nodes.map(n => toRFNode(n, viewMode, [...(kf.get(n.key) ?? [])])));
  }, [graph.nodes, graph.edges, viewMode, setRfNodes]);
  useEffect(() => { setRfEdges(buildRfEdges(graph.edges, graph.nodes, viewMode)); }, [graph.edges, graph.nodes, viewMode, setRfEdges]);

  // Mark only the selected relationship as reconnectable so dragging an endpoint
  // moves the line the user picked (not whichever overlapping edge RF would grab),
  // and raise it above the others so its reconnect anchor isn't buried under an
  // overlapping line (otherwise the drag handle never appears). Patches in place —
  // never touches `selected` — and re-applies after any rebuild of the edges array.
  useEffect(() => {
    const selId = selection?.type === "edge" ? selection.id : null;
    setRfEdges(eds => eds.map(e => {
      const modelEdgeId = (e.data as { modelEdgeId?: string } | undefined)?.modelEdgeId;
      const reconnectable = isEdgeReconnectable(modelEdgeId, selId, viewMode);
      const zIndex = modelEdgeId != null && modelEdgeId === selId ? 1000 : 0;
      return (e.reconnectable === reconnectable && e.zIndex === zIndex) ? e : { ...e, reconnectable, zIndex };
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
      // Turn on node transitions, move everything, then frame the result — so the
      // model visibly "organizes itself" instead of snapping. Cleared after the
      // glide so dragging stays instant.
      setLayoutAnimating(true);
      positions.forEach((pos, key) => store.updateNode(key, { position: pos }));
      setTimeout(() => fitView({ duration: 500, padding: 0.18 }), 30);
      setTimeout(() => setLayoutAnimating(false), 560);
      return;
    }
    setTool(t);
  }, [viewMode, fitView]);

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

  // Export the canvas as an SVG (whole model, OWOX watermark). Uses the live RF
  // node list (measured sizes) to frame the export.
  const imageName = (me?.projectTitle ?? "model").trim() || "model";
  const handleExportSvg = useCallback(() => {
    exportCanvasSvg(rfNodes, imageName).catch(() => setShareToast("Couldn't export the image — please try again."));
  }, [rfNodes, imageName]);

  // Copy a shareable link that reopens this exact model. Falls back to a prompt
  // if the clipboard API is blocked (insecure context / permissions).
  const handleShare = useCallback(async () => {
    const url = buildShareUrl(store.get());
    // The whole model rides in the link's #hash, so it works on whatever origin
    // serves the app. On localhost that's only this machine — flag it so a local
    // dev doesn't think the link is broken; on model.owox.com it just works.
    const isLocal = /^(localhost|127\.|0\.0\.0\.0|\[::1\])/.test(location.hostname);
    const msg = isLocal
      ? "Link copied — note: a localhost link only opens on this machine. Deploy to share it."
      : "Link copied — anyone with it can open this model.";
    try {
      await navigator.clipboard.writeText(url);
      setShareToast(msg);
    } catch {
      window.prompt("Copy this shareable link:", url);
    }
  }, []);

  // Auto-layout a freshly loaded graph (import or template). The OKF format does
  // not persist node positions (Dagre re-lays out on load, by design), so without
  // this every imported node piles up at the origin and must be dragged apart.
  const withLayout = useCallback((g: ModelGraph): ModelGraph => {
    const positions = runDagreLayout(g.nodes, g.edges, viewMode);
    return { ...g, nodes: g.nodes.map(n => ({ ...n, position: positions.get(n.key) ?? n.position })) };
  }, [viewMode]);

  // Merge a freshly loaded graph into the canvas, laying out only the new nodes
  // so the existing layout isn't reshuffled. Shared by OKF + OWOX import (merge).
  const applyMergeWithLayout = useCallback((g: ModelGraph) => {
    const { graph, newKeys } = mergeGraphs(store.get(), g);
    const positions = runDagreLayout(graph.nodes, graph.edges, viewMode);
    store.set({ ...graph, nodes: graph.nodes.map(n => newKeys.has(n.key) ? { ...n, position: positions.get(n.key) ?? n.position } : n) });
  }, [viewMode]);

  const handleImportConfirm = useCallback((g: ModelGraph, mode: "replace" | "merge") => {
    if (mode === "merge") {
      applyMergeWithLayout(g);
    } else {
      // Keep the currently-selected storage. The OKF bundle format doesn't carry a
      // storageId (parse returns null), so taking the imported value would blank the
      // selection. Fall back to the imported id only when none is selected yet.
      store.set({ ...withLayout(g), storageId: store.get().storageId ?? g.storageId });
    }
    setShowImport(false);
  }, [withLayout, applyMergeWithLayout]);

  const handleOwoxImportConfirm = useCallback((g: ModelGraph, mode: "replace" | "merge") => {
    if (mode === "merge") applyMergeWithLayout(g);
    else store.set({ ...withLayout(g), storageId: g.storageId });
    setShowOwoxImport(false);
  }, [withLayout, applyMergeWithLayout]);

  const applyTemplate = useCallback((g: ModelGraph, mode: "replace" | "merge") => {
    // Keep the model on the currently selected storage; auto-layout the template.
    if (mode === "merge") applyMergeWithLayout(g);
    else store.set({ ...withLayout(g), storageId: store.get().storageId });
  }, [withLayout, applyMergeWithLayout]);

  const handleUseTemplate = useCallback((g: ModelGraph, name: string) => {
    // Remember the matching niche so the Business Goal dialog can pre-pick it.
    if (TEMPLATE_NICHE[name]) setSuggestedNiche(TEMPLATE_NICHE[name]);
    // Empty canvas → drop the template straight in. Non-empty → ask Replace vs
    // Merge first (mirrors the OKF/OWOX import dialogs) so existing work isn't
    // silently wiped.
    if (store.get().nodes.length === 0) {
      applyTemplate(g, "replace");
      setShowLibrary(false);
    } else {
      setPendingTemplate({ graph: g, name });
    }
  }, [applyTemplate]);

  const handleTemplateApplyConfirm = useCallback((mode: "replace" | "merge") => {
    if (pendingTemplate) applyTemplate(pendingTemplate.graph, mode);
    setPendingTemplate(null);
    setShowLibrary(false);
  }, [pendingTemplate, applyTemplate]);

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
    // Anonymous → sign in first (no project/storage to confirm yet). Signed-in →
    // confirm the target project + storage before sending (users kept pushing to
    // the wrong storage).
    if (pushIntent(me) === "sign-in") { setSignIn({ mode: "push" }); return; }
    setShowPushConfirm(true);
  }, [me]);

  // Any sign-out detaches the model from OWOX (owoxId/created → unpushed drafts),
  // so the same marts can be pushed into a different project after re-signing in.
  const handleSignOut = useCallback(() => {
    store.set(detachFromOwox(store.get()));
    void signOut();
  }, [signOut]);

  // From the push dialog: detach + sign out, then immediately open sign-in so the
  // user can connect a different project's key.
  const handleChangeProject = useCallback(() => {
    setShowPushConfirm(false);
    handleSignOut();
    setSignIn({ mode: "connect" });
  }, [handleSignOut]);

  // ── Pending count for TopBar ───────────────────────────────────────────────
  const pendingCount = graph.nodes.filter(n => n.status === "pending").length;

  // ── Canvas class based on tool ─────────────────────────────────────────────
  const canvasClass = [
    tool === "add" ? "canvas-add" : tool === "connect" ? "canvas-connect" : "",
    layoutAnimating ? "canvas-animating" : "",
  ].filter(Boolean).join(" ");

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
        onImportFromOwox={() => setShowOwoxImport(true)}
        onExport={handleExport}
        onExportSvg={handleExportSvg}
        exportDisabled={graph.nodes.length === 0}
        onShare={handleShare}
        shareDisabled={graph.nodes.length === 0}
        onPush={handlePush}
        onLibrary={() => setShowLibrary(true)}
        onOpenGoal={() => setShowGoal(true)}
        goalSet={!!goal}
        questionsEnabled={questionsEnabled}
        signedIn={!!me}
        projectTitle={me?.projectTitle}
        onSignIn={() => setSignIn({ mode: "connect" })}
        onSignOut={handleSignOut}
      />
      {shareToast && <ShareToast message={shareToast} onClose={() => setShareToast(null)} />}
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
      {showOwoxImport && (
        <OwoxImportDialog
          storages={storages}
          onConfirm={handleOwoxImportConfirm}
          onClose={() => setShowOwoxImport(false)}
        />
      )}
      {showPushConfirm && me && (
        <PushConfirmDialog
          projectTitle={me.projectTitle}
          storage={storages.find(s => s.id === graph.storageId) ?? null}
          counts={pushPreview(graph, graph.storageId)}
          onConfirm={() => { setShowPushConfirm(false); void runPush(); }}
          onChangeProject={handleChangeProject}
          onClose={() => setShowPushConfirm(false)}
        />
      )}
      {showWelcome && (
        <WelcomeDialog
          onUseTemplate={(g, name) => { handleUseTemplate(g, name); setShowWelcome(false); }}
          onStartBlank={() => setShowWelcome(false)}
          onImport={() => { setShowWelcome(false); setShowImport(true); }}
        />
      )}
      {showLibrary && (
        <LibraryDialog
          onUse={handleUseTemplate}
          onClose={() => setShowLibrary(false)}
        />
      )}
      {pendingTemplate && (
        <TemplateApplyDialog
          graph={pendingTemplate.graph}
          name={pendingTemplate.name}
          onConfirm={handleTemplateApplyConfirm}
          onClose={() => setPendingTemplate(null)}
        />
      )}
      {showGoal && (
        <GoalDialog
          current={goal}
          suggestedNiche={suggestedNiche}
          onConfirm={g => { setGoalState(g); persistGoal(g); setShowGoal(false); }}
          onClear={() => { setGoalState(null); persistGoal(null); setShowGoal(false); }}
          onClose={() => setShowGoal(false)}
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

          {/* Insight Questions hero — surfaces the AI feature once a model exists.
              Shown only while AI is available and no goal is set yet; dismissable. */}
          {questionsEnabled && graph.nodes.length > 0 && !goal && !heroDismissed && (
            <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-[5] flex items-center gap-3 rounded-xl border border-[#d8dee8] bg-white px-4 py-2.5 shadow-[0_8px_24px_rgba(15,23,42,0.14)]">
              <Sparkles size={16} className="flex-shrink-0 text-[#1e88e5]" />
              <span className="text-[13px] text-slate-700">See the business questions this model can answer</span>
              <button
                onClick={() => { setHeroDismissed(true); setShowGoal(true); }}
                className="rounded-lg bg-[#1e88e5] px-3 py-[6px] text-[13px] font-[600] text-white hover:bg-[#1976d2]"
              >
                Show me
              </button>
              <button onClick={() => setHeroDismissed(true)} aria-label="Dismiss" className="text-slate-400 hover:text-slate-700">
                <X size={15} />
              </button>
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
          goal={goal}
          questionsEnabled={questionsEnabled}
          onEditGoal={() => setShowGoal(true)}
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

// ── Share confirmation toast (auto-dismisses) ─────────────────────────────────
function ShareToast({ message, onClose }: { message: string; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3500);
    return () => clearTimeout(t);
  }, [onClose]);
  return (
    <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-xl border border-emerald-300 bg-white px-4 py-3 text-[13px] shadow-2xl">
      <span className="h-2 w-2 rounded-full bg-emerald-500 flex-shrink-0" />
      <span className="text-slate-800">{message}</span>
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
