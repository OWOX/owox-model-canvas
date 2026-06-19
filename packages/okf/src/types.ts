export type InputSource = "SQL" | "CONNECTOR" | "VIEW" | "TABLE";
export type NodeStatus = "pending" | "creating" | "created" | "error";

export interface SchemaField { name: string; type: string; pk: boolean; }
export interface JoinKey { left: string; right: string; }

export interface ModelNode {
  key: string;
  title: string;
  inputSource: InputSource;
  description?: string;
  definition?: string | null;   // optional source definition (SQL / table ref / view)
  schema: SchemaField[];
  position: { x: number; y: number };
  status: NodeStatus;
  owoxId?: string | null;
  createdAt?: string | null;
  createdBy?: string | null;
  error?: string | null;
}
export interface ModelEdge {
  id: string;
  from: string;
  to: string;
  keys: JoinKey[];
  bidirectional: boolean;
  // Canvas-only hints for which ports the edge attaches to (not encoded in OKF).
  sourceHandle?: string | null;
  targetHandle?: string | null;
}
export interface ModelGraph {
  storageId: string | null;
  nodes: ModelNode[];
  edges: ModelEdge[];
}
