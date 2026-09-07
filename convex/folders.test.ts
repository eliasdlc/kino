import { convexTest } from 'convex-test';
import { describe, expect, it } from 'vitest';
import { api } from './_generated/api';
import type { Doc, Id } from './_generated/dataModel';
import { ancestorsOf, buildTree, subtreeIds, type FolderNode } from './folders';
import schema from './schema';

const modules = import.meta.glob('./**/*.*s');
const ana = { subject: 'user_ana', email: 'ana@usekino.dev', name: 'Ana' };

/**
 * Sesenta carpetas en cinco niveles: cada carpeta de un nivel tiene hijos en
 * el siguiente hasta sumar sesenta. El `path` de ltree se calcula aparte, como
 * lo tenía Postgres, y sirve de referencia para comparar el árbol en memoria.
 */
function sixtyFolders(userId: Id<'users'>, systemId: Id<'systems'>) {
  const docs: Doc<'folders'>[] = [];
  const paths = new Map<string, string>();
  const make = (index: number, parent?: Doc<'folders'>) => {
    const id = `folders:${index}` as Id<'folders'>;
    const doc: Doc<'folders'> = {
      _id: id,
      _creationTime: index,
      userId,
      systemId,
      parentId: parent?._id,
      name: `Carpeta ${index}`,
      color: 'blue',
      createdBy: userId,
      createdVia: 'session',
      sortIndex: index % 7,
      createdAt: index,
      updatedAt: index,
    };
    docs.push(doc);
    paths.set(id, parent ? `${paths.get(parent._id)}.${id}` : id);
    return doc;
  };
  let index = 0;
  let level: Doc<'folders'>[] = [make(index++)];
  for (let depth = 1; depth < 5 && index < 60; depth += 1) {
    const next: Doc<'folders'>[] = [];
    for (const parent of level) {
      for (let k = 0; k < 3 && index < 60; k += 1) next.push(make(index++, parent));
    }
    level = next;
  }
  return { docs, paths };
}

function flatten(nodes: FolderNode[]): FolderNode[] {
  return nodes.flatMap((node) => [node, ...flatten(node.children)]);
}

describe('el árbol en memoria', () => {
  const { docs, paths } = sixtyFolders('users:1' as Id<'users'>, 'systems:1' as Id<'systems'>);

  it('tiene sesenta carpetas en cinco niveles', () => {
    expect(docs).toHaveLength(60);
    expect(Math.max(...[...paths.values()].map((p) => p.split('.').length))).toBe(5);
  });

  it('contiene todas las carpetas y respeta cada padre', () => {
    const tree = buildTree(docs);
    const all = flatten(tree);
    expect(all).toHaveLength(60);
    for (const node of all) {
      for (const child of node.children) expect(child.parentId).toBe(node.id);
    }
    expect(tree.map((root) => root.parentId)).toEqual([null]);
  });

  it('el subárbol es lo que ltree devolvía con `path <@ raíz`', () => {
    for (const root of docs) {
      const byLtree = docs
        .filter((doc) => paths.get(doc._id)!.startsWith(paths.get(root._id)!))
        .map((doc) => doc._id)
        .sort();
      expect([...subtreeIds(docs, root._id)].sort()).toEqual(byLtree);
    }
  });

  it('las migas son los ancestros en el orden de `nlevel`', () => {
    for (const doc of docs) {
      const byLtree = paths.get(doc._id)!.split('.').slice(0, -1);
      expect(ancestorsOf(docs, doc._id).map((item) => item.id)).toEqual(byLtree);
    }
  });
});

describe('folders sobre convex-test', () => {
  async function seed(t: ReturnType<typeof convexTest>) {
    const asAna = t.withIdentity(ana);
    const userId = await asAna.mutation(api.users.ensure, {});
    const systemId = await t.run((ctx) =>
      ctx.db.insert('systems', {
        userId,
        createdBy: userId,
        createdVia: 'session',
        name: 'Novela',
        color: 'purple',
        templateType: 'writing',
        icon: 'book',
        isActive: true,
        isInbox: false,
        sortOrder: 0,
        createdAt: 1,
        updatedAt: 1,
      }),
    );
    return { asAna, userId, systemId };
  }

  it('crear, listar con cuentas y borrar en cascada', async () => {
    const t = convexTest(schema, modules);
    const { asAna, userId, systemId } = await seed(t);
    const parte = await asAna.mutation(api.folders.create, { systemId, name: 'Parte 1' });
    const capitulo = await asAna.mutation(api.folders.create, {
      systemId,
      name: 'Capítulo 1',
      parentId: parte.id,
    });
    await t.run(async (ctx) => {
      await ctx.db.insert('pages', { userId, createdBy: userId, createdVia: 'session', folderId: capitulo.id, systemId, isPinned: false, createdAt: 1, updatedAt: 1 });
      await ctx.db.insert('stickyNotes', { userId, createdBy: userId, createdVia: 'session', folderId: capitulo.id, color: 'yellow', sortIndex: 0, isEureka: false, createdAt: 1, updatedAt: 1 });
    });

    const roots = await asAna.query(api.folders.bySystem, { systemId });
    expect(roots).toMatchObject([{ id: parte.id, subfolderCount: 1, pageCount: 0 }]);
    const kids = await asAna.query(api.folders.children, { id: parte.id });
    expect(kids).toMatchObject([{ id: capitulo.id, subfolderCount: 0, pageCount: 1 }]);
    expect((await asAna.query(api.folders.detail, { id: capitulo.id })).breadcrumb.map((c) => c.name)).toEqual(['Parte 1']);

    await asAna.mutation(api.folders.remove, { id: parte.id });
    expect(await asAna.query(api.folders.tree, {})).toEqual([]);
    const left = await t.run(async (ctx) => ({
      pages: await ctx.db.query('pages').collect(),
      notes: await ctx.db.query('stickyNotes').collect(),
      folders: await ctx.db.query('folders').collect(),
    }));
    expect(left.pages[0].folderId).toBeUndefined();
    // El borrado es blando: la nota y las carpetas siguen ahí, marcadas.
    expect(left.notes).toHaveLength(1);
    expect(left.notes[0].deletedAt).toEqual(expect.any(Number));
    expect(left.folders).toHaveLength(2);
    expect(left.folders.every((doc) => doc.deletedAt !== undefined)).toBe(true);
  });

  it('una carpeta ajena no existe para quien no es su dueño', async () => {
    const t = convexTest(schema, modules);
    const { asAna, systemId } = await seed(t);
    const folder = await asAna.mutation(api.folders.create, { systemId, name: 'Privada' });
    const bob = t.withIdentity({ subject: 'user_bob', email: 'bob@usekino.dev' });
    await bob.mutation(api.users.ensure, {});
    await expect(bob.query(api.folders.children, { id: folder.id })).rejects.toThrow();
  });
});
