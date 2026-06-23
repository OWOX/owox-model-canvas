import { describe, it, expect, vi } from "vitest";
import { pushModel, pushPreview } from "../src/sync/push";
import { createModelStore } from "../src/state/model";
import type { ModelGraph } from "@mc/okf";

describe("pushPreview", () => {
  const mk = (over: Partial<ModelGraph>): ModelGraph => ({ storageId: "st_1", nodes: [], edges: [], ...over });

  it("counts a stale 'created' mart (different storage) as to-be-pushed", () => {
    const g = mk({ nodes: [
      { key: "n1", title: "A", inputSource: "SQL", schema: [], position: { x: 0, y: 0 }, status: "created", owoxId: "a", owoxStorageId: "OLD" },
    ] });
    expect(pushPreview(g, "st_1").marts).toBe(1);
  });
  it("does not count a mart already live in the active storage", () => {
    const g = mk({ nodes: [
      { key: "n1", title: "A", inputSource: "SQL", schema: [], position: { x: 0, y: 0 }, status: "created", owoxId: "a", owoxStorageId: "st_1" },
    ] });
    expect(pushPreview(g, "st_1").marts).toBe(0);
  });
  it("skips an existing edge only when both endpoints stay (else counts it)", () => {
    const live = { inputSource: "SQL" as const, schema: [], position: { x: 0, y: 0 }, status: "created" as const };
    const skipBoth = mk({
      nodes: [
        { key: "n1", title: "A", ...live, owoxId: "a", owoxStorageId: "st_1" },
        { key: "n2", title: "B", ...live, owoxId: "b", owoxStorageId: "st_1" },
      ],
      edges: [{ id: "e1", from: "n1", to: "n2", keys: [], bidirectional: false, existing: true }],
    });
    expect(pushPreview(skipBoth, "st_1").relationships).toBe(0);
    const staleEnd = mk({
      nodes: [
        { key: "n1", title: "A", ...live, owoxId: "a", owoxStorageId: "OLD" },
        { key: "n2", title: "B", ...live, owoxId: "b", owoxStorageId: "st_1" },
      ],
      edges: [{ id: "e1", from: "n1", to: "n2", keys: [], bidirectional: false, existing: true }],
    });
    expect(pushPreview(staleEnd, "st_1").relationships).toBe(1);
  });
});

describe("pushModel", () => {
  it("creates pending nodes, stores owoxId, sets created", async () => {
    const s = createModelStore({ storageId: "stor_1" });
    s.addNode({ x: 0, y: 0 });
    const calls: string[] = [];
    const apiMock = vi.fn(async (path: string) => { calls.push(path); return { id: "owox_a" }; });
    const res = await pushModel(s, apiMock as any);
    expect(calls).toContain("/api/data-marts");
    expect(s.get().nodes[0].status).toBe("created");
    expect(s.get().nodes[0].owoxId).toBe("owox_a");
    expect(s.get().nodes[0].owoxStorageId).toBe("stor_1"); // tagged with the storage it was created in
    expect(res.created).toBe(1); expect(res.failed).toBe(0);
  });
  it("pushes the input-source type in the definition envelope", async () => {
    const s = createModelStore({ storageId: "stor_1" });
    const n = s.addNode({ x: 0, y: 0 });
    s.updateNode(n.key, { inputSource: "TABLE", definition: "proj.ds.orders" });
    const bodies: Record<string, any> = {};
    const apiMock = vi.fn(async (path: string, init?: any) => {
      if (init?.body) bodies[path] = JSON.parse(init.body);
      return { id: "owox_a" };
    });
    await pushModel(s, apiMock as any);
    const defBody = bodies["/api/data-marts/owox_a/definition"];
    expect(defBody).toEqual({ definitionType: "TABLE", definition: { fullyQualifiedName: "proj.ds.orders" } });
  });

  it("pushes VIEW as a fully-qualified reference, not a SQL query", async () => {
    const s = createModelStore({ storageId: "stor_1" });
    const n = s.addNode({ x: 0, y: 0 });
    s.updateNode(n.key, { inputSource: "VIEW", definition: "proj.ds.sessions_v" });
    const bodies: Record<string, any> = {};
    const apiMock = vi.fn(async (path: string, init?: any) => {
      if (init?.body) bodies[path] = JSON.parse(init.body);
      return { id: "owox_a" };
    });
    await pushModel(s, apiMock as any);
    expect(bodies["/api/data-marts/owox_a/definition"])
      .toEqual({ definitionType: "VIEW", definition: { fullyQualifiedName: "proj.ds.sessions_v" } });
  });

  it("pushes per-field alias and description in the output schema", async () => {
    const s = createModelStore({ storageId: "stor_1" });
    const n = s.addNode({ x: 0, y: 0 });
    s.updateNode(n.key, { schema: [{ name: "id", type: "STRING", pk: true, alias: "user_id", description: "Unique id" }] });
    const bodies: Record<string, any> = {};
    const apiMock = vi.fn(async (path: string, init?: any) => {
      if (init?.body) bodies[path] = JSON.parse(init.body);
      return { id: "owox_a" };
    });
    await pushModel(s, apiMock as any, "GOOGLE_BIGQUERY");
    const field = bodies["/api/data-marts/owox_a/schema"].schema.fields[0];
    expect(field).toMatchObject({ name: "id", alias: "user_id", description: "Unique id", isPrimaryKey: true });
  });

  it("marks a node error on failure and counts it", async () => {
    const s = createModelStore({ storageId: "stor_1" }); s.addNode({ x: 0, y: 0 });
    const apiMock = vi.fn(async () => { throw new Error("boom"); });
    const res = await pushModel(s, apiMock as any);
    expect(s.get().nodes[0].status).toBe("error");
    expect(res.failed).toBe(1);
  });

  it("never sends cardinality in the relationship body", async () => {
    const s = createModelStore({ storageId: "stor_1" });
    s.set({
      storageId: "stor_1",
      nodes: [
        { key: "n1", title: "Orders", inputSource: "SQL", schema: [{ name: "customer_id", type: "STRING", pk: false }], position: { x: 0, y: 0 }, status: "created", owoxId: "owox_a", owoxStorageId: "stor_1" },
        { key: "n2", title: "Customers", inputSource: "SQL", schema: [{ name: "id", type: "STRING", pk: true }], position: { x: 100, y: 0 }, status: "created", owoxId: "owox_b", owoxStorageId: "stor_1" },
      ],
      edges: [
        { id: "e1", from: "n1", to: "n2", keys: [{ left: "customer_id", right: "id" }], bidirectional: false, cardinality: "N:1" },
      ],
    });
    const relationshipBodies: string[] = [];
    const apiMock = vi.fn(async (path: string, init?: any) => {
      if (path.includes("/relationships") && init?.body) relationshipBodies.push(init.body as string);
      return { id: "owox_rel" };
    });
    await pushModel(s, apiMock as any);
    expect(relationshipBodies.length).toBeGreaterThan(0);
    for (const b of relationshipBodies) expect(b).not.toContain("cardinality");
  });

  it("skips an imported edge (existing: true) — no relationship POST for a join that already exists in OWOX", async () => {
    const s = createModelStore({ storageId: "stor_1" });
    s.set({
      storageId: "stor_1",
      nodes: [
        { key: "n1", title: "Orders", inputSource: "SQL", schema: [{ name: "customer_id", type: "STRING", pk: false }], position: { x: 0, y: 0 }, status: "created", owoxId: "owox_a", owoxStorageId: "stor_1" },
        { key: "n2", title: "Customers", inputSource: "SQL", schema: [{ name: "id", type: "STRING", pk: true }], position: { x: 100, y: 0 }, status: "created", owoxId: "owox_b", owoxStorageId: "stor_1" },
      ],
      edges: [
        { id: "e1", from: "n1", to: "n2", keys: [{ left: "customer_id", right: "id" }], bidirectional: false, existing: true },
      ],
    });
    const relationshipCalls: string[] = [];
    const apiMock = vi.fn(async (path: string) => {
      if (path.includes("/relationships")) relationshipCalls.push(path);
      return { id: "owox_rel" };
    });
    const res = await pushModel(s, apiMock as any);
    expect(relationshipCalls).toHaveLength(0);
    expect(res.relationshipsCreated).toBe(0);
    expect(res.relationshipsFailed).toBe(0);
    expect(res.errors).toHaveLength(0);
  });

  it("recreates a 'created' mart whose owoxStorageId is a different storage (project/storage switch)", async () => {
    const s = createModelStore({ storageId: "stor_NEW" });
    s.set({
      storageId: "stor_NEW",
      // Imported from another project: created + owoxId, but tagged to a different storage.
      nodes: [
        { key: "n1", title: "Orders", inputSource: "SQL", schema: [], position: { x: 0, y: 0 }, status: "created", owoxId: "old_id", owoxStorageId: "stor_OLD" },
      ],
      edges: [],
    });
    const calls: string[] = [];
    const apiMock = vi.fn(async (path: string) => { calls.push(path); return { id: "new_id" }; });
    const res = await pushModel(s, apiMock as any);
    expect(calls).toContain("/api/data-marts");        // recreated, not skipped
    expect(res.created).toBe(1);
    expect(s.get().nodes[0].owoxId).toBe("new_id");
    expect(s.get().nodes[0].owoxStorageId).toBe("stor_NEW"); // re-tagged to the active storage
  });

  it("pushes an imported (existing) edge when an endpoint was recreated in a different storage", async () => {
    const s = createModelStore({ storageId: "stor_NEW" });
    s.set({
      storageId: "stor_NEW",
      nodes: [
        { key: "n1", title: "Orders", inputSource: "SQL", schema: [{ name: "customer_id", type: "STRING", pk: false }], position: { x: 0, y: 0 }, status: "created", owoxId: "old_a", owoxStorageId: "stor_OLD" },
        { key: "n2", title: "Customers", inputSource: "SQL", schema: [{ name: "id", type: "STRING", pk: true }], position: { x: 100, y: 0 }, status: "created", owoxId: "old_b", owoxStorageId: "stor_OLD" },
      ],
      edges: [
        { id: "e1", from: "n1", to: "n2", keys: [{ left: "customer_id", right: "id" }], bidirectional: false, existing: true },
      ],
    });
    const relationshipCalls: string[] = [];
    const apiMock = vi.fn(async (path: string) => { if (path.includes("/relationships")) relationshipCalls.push(path); return { id: "x" }; });
    const res = await pushModel(s, apiMock as any);
    // Marts were recreated in stor_NEW, so the join doesn't exist there yet → must be pushed.
    expect(relationshipCalls.length).toBeGreaterThan(0);
    expect(res.relationshipsCreated).toBeGreaterThan(0);
  });

  it("uses an underscore identifier (not a hyphenated slug) for targetAlias", async () => {
    const s = createModelStore({ storageId: "stor_1" });
    s.set({
      storageId: "stor_1",
      nodes: [
        { key: "n1", title: "Comments", inputSource: "TABLE", schema: [{ name: "post_id", type: "INTEGER", pk: false }], position: { x: 0, y: 0 }, status: "created", owoxId: "owox_a", owoxStorageId: "stor_1" },
        { key: "n2", title: "Posts Questions", inputSource: "TABLE", schema: [{ name: "id", type: "INTEGER", pk: true }], position: { x: 100, y: 0 }, status: "created", owoxId: "owox_b", owoxStorageId: "stor_1" },
      ],
      edges: [{ id: "e1", from: "n1", to: "n2", keys: [{ left: "post_id", right: "id" }], bidirectional: false }],
    });
    const bodies: any[] = [];
    const apiMock = vi.fn(async (path: string, init?: any) => {
      if (path.includes("/relationships") && init?.body) bodies.push(JSON.parse(init.body));
      return { id: "owox_rel" };
    });
    await pushModel(s, apiMock as any);
    expect(bodies[0].targetAlias).toBe("posts_questions");
    expect(bodies[0].targetAlias).not.toContain("-");
  });

  it("creates a missing join field with the counterpart's type, not STRING", async () => {
    const s = createModelStore({ storageId: "stor_1" });
    s.set({
      storageId: "stor_1",
      // newobj has an empty schema; the join pairs newobj.id with badges.id (INTEGER).
      nodes: [
        { key: "newobj", title: "New object", inputSource: "SQL", schema: [], position: { x: 0, y: 0 }, status: "created", owoxId: "owox_a", owoxStorageId: "stor_1" },
        { key: "badges", title: "Badges", inputSource: "TABLE", schema: [{ name: "id", type: "INTEGER", pk: true }], position: { x: 100, y: 0 }, status: "created", owoxId: "owox_b", owoxStorageId: "stor_1" },
      ],
      edges: [{ id: "e1", from: "newobj", to: "badges", keys: [{ left: "id", right: "id" }], bidirectional: false }],
    });
    const apiMock = vi.fn(async () => ({ id: "owox_rel" }));
    await pushModel(s, apiMock as any);
    const added = s.get().nodes.find(n => n.key === "newobj")!.schema.find(f => f.name === "id");
    expect(added?.type).toBe("INTEGER");
  });

  it("coerces an existing FK field's type to match the referenced PK", async () => {
    const s = createModelStore({ storageId: "stor_1" });
    s.set({
      storageId: "stor_1",
      // newobj.id ALREADY exists as STRING (created in an earlier session); tags.id is an INTEGER PK.
      nodes: [
        { key: "newobj", title: "New object", inputSource: "SQL", schema: [{ name: "id", type: "STRING", pk: false }], position: { x: 0, y: 0 }, status: "created", owoxId: "owox_a", owoxStorageId: "stor_1" },
        { key: "tags", title: "Tags", inputSource: "TABLE", schema: [{ name: "id", type: "INTEGER", pk: true }], position: { x: 100, y: 0 }, status: "created", owoxId: "owox_b", owoxStorageId: "stor_1" },
      ],
      edges: [{ id: "e1", from: "newobj", to: "tags", keys: [{ left: "id", right: "id" }], bidirectional: true }],
    });
    const apiMock = vi.fn(async () => ({ id: "owox_rel" }));
    await pushModel(s, apiMock as any);
    expect(s.get().nodes.find(n => n.key === "newobj")!.schema.find(f => f.name === "id")!.type).toBe("INTEGER");
  });
});
