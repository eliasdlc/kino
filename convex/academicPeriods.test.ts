import { convexTest } from 'convex-test';
import { describe, expect, it } from 'vitest';
import { api } from './_generated/api';
import schema from './schema';
const modules = import.meta.glob('./**/*.*s');
const identity = { subject: 'academic_ana', email: 'ana@example.com' };

async function setup() {
  const t = convexTest(schema, modules), user = t.withIdentity(identity);
  const system = await user.mutation(api.systems.create, { name: 'University', icon: 'book', color: 'blue', templateType: 'academic' });
  return { t, user, systemId: system.id };
}
describe('ciclos académicos', () => {
  it('separa tareas, apuntes y subpáginas por ciclo sin perder lo anterior ni lo no asignado', async () => {
    const { user, systemId } = await setup();
    const old = await user.mutation(api.academicPeriods.create, { systemId, year: '2025–2026', name: 'Primero' });
    const current = await user.mutation(api.academicPeriods.create, { systemId, year: '2026–2027', name: 'Primero' });
    const exported = await user.query(api.portabilidad.workspace, {});
    expect(exported.tablas.academicPeriods).toHaveLength(2);
    const folder = await user.mutation(api.folders.create, { systemId, name: 'Cálculo', academicPeriodId: old });
    const task = await user.mutation(api.tasks.create, { systemId, folderId: folder.id, title: 'Anterior' });
    const unassigned = await user.mutation(api.tasks.create, { systemId, title: 'Sin materia' });
    const page = await user.mutation(api.pages.create, { systemId, folderId: folder.id, title: 'Apunte', content: '<p>Conservar</p>' });
    const subpage = await user.mutation(api.pages.create, { systemId, parentPageId: page.id, title: 'Subpágina' });
    await user.mutation(api.academicPeriods.update, { id: current, isCurrent: true });
    expect((await user.query(api.tasks.bySystem, { systemId, academicPeriodId: current }))).toEqual([]);
    expect((await user.query(api.tasks.bySystem, { systemId, academicPeriodId: old })).map(t => t.id)).toEqual([task.id]);
    expect((await user.query(api.tasks.bySystem, { systemId, academicPeriodId: null })).map(t => t.id)).toEqual([unassigned.id]);
    expect((await user.query(api.pages.bySystem, { systemId, academicPeriodId: old })).items.map(p => p.id)).toEqual(expect.arrayContaining([page.id, subpage.id]));
    await user.mutation(api.academicPeriods.assignSubject, { folderId: folder.id, periodId: current });
    expect((await user.query(api.pages.bySystem, { systemId, academicPeriodId: old })).items).toEqual([]);
    expect((await user.query(api.pages.byId, { id: page.id })).content).toBe('<p>Conservar</p>');
    expect((await user.query(api.tasks.bySystem, { systemId, academicPeriodId: current })).map(t => t.id)).toEqual([task.id]);
    await user.mutation(api.academicPeriods.update, { id: current, isClosed: true });
    expect((await user.query(api.academicPeriods.list, { systemId })).find(p => p._id === current)).toMatchObject({ isCurrent: false, isClosed: true });
    expect((await user.query(api.tasks.bySystem, { systemId, academicPeriodId: current }))).toHaveLength(1);
  });
  it('rechaza períodos ajenos, sistemas no académicos, duplicados y ciclos cruzados', async () => {
    const { t, user, systemId } = await setup();
    const id = await user.mutation(api.academicPeriods.create, { systemId, year: '2026', name: 'Primero' });
    await expect(user.mutation(api.academicPeriods.create, { systemId, year: '2026', name: ' primero ' })).rejects.toThrow();
    const outsider = t.withIdentity({ subject: 'other', email: 'other@example.com' });
    await outsider.mutation(api.users.ensure, {});
    await expect(outsider.query(api.academicPeriods.list, { systemId })).rejects.toThrow();
    await expect(outsider.mutation(api.academicPeriods.update, { id, name: 'Robo' })).rejects.toThrow();
    const otherSystem = await user.mutation(api.systems.create, { name: 'Otro', icon: 'book', color: 'blue', templateType: 'academic' });
    const folder = await user.mutation(api.folders.create, { systemId: otherSystem.id, name: 'Otra' });
    await expect(user.mutation(api.academicPeriods.assignSubject, { folderId: folder.id, periodId: id })).rejects.toThrow();
    await expect(user.mutation(api.folders.create, { systemId: otherSystem.id, name: 'Otra', academicPeriodId: id })).rejects.toThrow();
    const personal = await user.mutation(api.systems.create, { name: 'Personal', icon: 'book', color: 'blue', templateType: 'personal' });
    await expect(user.mutation(api.academicPeriods.create, { systemId: personal.id, year: '2026', name: 'Primero' })).rejects.toThrow();
  });
  it('solo un ciclo queda actual y las subcarpetas heredan el período de su materia', async () => {
    const { user, systemId } = await setup();
    const first = await user.mutation(api.academicPeriods.create, { systemId, year: '2026', name: 'Primero' });
    const second = await user.mutation(api.academicPeriods.create, { systemId, year: '2026', name: 'Segundo' });
    await Promise.all([user.mutation(api.academicPeriods.update, { id: first, isCurrent: true }), user.mutation(api.academicPeriods.update, { id: second, isCurrent: true })]);
    expect((await user.query(api.academicPeriods.list, { systemId })).filter(p => p.isCurrent)).toHaveLength(1);
    const root = await user.mutation(api.folders.create, { systemId, name: 'Materia', academicPeriodId: first });
    const child = await user.mutation(api.folders.create, { systemId, name: 'Tema', parentId: root.id });
    await user.mutation(api.tasks.create, { systemId, folderId: child.id, title: 'Subcarpeta' });
    expect((await user.query(api.tasks.bySystem, { systemId, academicPeriodId: first }))).toHaveLength(1);
    await expect(user.mutation(api.academicPeriods.assignSubject, { folderId: child.id, periodId: second })).rejects.toThrow();
    await user.mutation(api.academicPeriods.update, { id: second, isClosed: true });
    await expect(user.mutation(api.academicPeriods.update, { id: second, isCurrent: true })).rejects.toThrow();
  });
});
