import { describe, it, expect, vi } from "vitest";
import { pushModel } from "../src/sync/push";
import { createModelStore } from "../src/state/model";

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
        { key: "n1", title: "Orders", inputSource: "SQL", schema: [{ name: "customer_id", type: "STRING", pk: false }], position: { x: 0, y: 0 }, status: "created", owoxId: "owox_a" },
        { key: "n2", title: "Customers", inputSource: "SQL", schema: [{ name: "id", type: "STRING", pk: true }], position: { x: 100, y: 0 }, status: "created", owoxId: "owox_b" },
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

  it("uses an underscore identifier (not a hyphenated slug) for targetAlias", async () => {
    const s = createModelStore({ storageId: "stor_1" });
    s.set({
      storageId: "stor_1",
      nodes: [
        { key: "n1", title: "Comments", inputSource: "TABLE", schema: [{ name: "post_id", type: "INTEGER", pk: false }], position: { x: 0, y: 0 }, status: "created", owoxId: "owox_a" },
        { key: "n2", title: "Posts Questions", inputSource: "TABLE", schema: [{ name: "id", type: "INTEGER", pk: true }], position: { x: 100, y: 0 }, status: "created", owoxId: "owox_b" },
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
        { key: "newobj", title: "New object", inputSource: "SQL", schema: [], position: { x: 0, y: 0 }, status: "created", owoxId: "owox_a" },
        { key: "badges", title: "Badges", inputSource: "TABLE", schema: [{ name: "id", type: "INTEGER", pk: true }], position: { x: 100, y: 0 }, status: "created", owoxId: "owox_b" },
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
        { key: "newobj", title: "New object", inputSource: "SQL", schema: [{ name: "id", type: "STRING", pk: false }], position: { x: 0, y: 0 }, status: "created", owoxId: "owox_a" },
        { key: "tags", title: "Tags", inputSource: "TABLE", schema: [{ name: "id", type: "INTEGER", pk: true }], position: { x: 100, y: 0 }, status: "created", owoxId: "owox_b" },
      ],
      edges: [{ id: "e1", from: "newobj", to: "tags", keys: [{ left: "id", right: "id" }], bidirectional: true }],
    });
    const apiMock = vi.fn(async () => ({ id: "owox_rel" }));
    await pushModel(s, apiMock as any);
    expect(s.get().nodes.find(n => n.key === "newobj")!.schema.find(f => f.name === "id")!.type).toBe("INTEGER");
  });
});
