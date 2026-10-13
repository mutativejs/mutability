import { mutate, apply } from '../src';

test('base - mutate', () => {
  const baseState = {
    a: {
      c: 1,
    },
  };
  const { patches, inversePatches } = mutate(baseState, (draft) => {
    draft.a.c = 2;
  });
  expect(baseState).toEqual({ a: { c: 2 } });
  expect({ patches, inversePatches }).toEqual({
    patches: [
      {
        op: 'replace',
        path: ['a', 'c'],
        value: 2,
      },
    ],
    inversePatches: [
      {
        op: 'replace',
        path: ['a', 'c'],
        value: 1,
      },
    ],
  });
  apply(baseState, inversePatches);
  expect(baseState).toEqual({ a: { c: 1 } });
});

test('base - mutate with error', () => {
  const baseState = {
    a: {
      c: 1,
    },
    b: {
      c: 1,
    },
  };
  try {
    mutate(baseState, (draft) => {
      draft.a.c = 2;
      throw new Error('error');
      draft.b.c = 2;
    });
  } catch (e) {
    //
  }
  expect(baseState).toEqual({
    a: {
      c: 1,
    },
    b: {
      c: 1,
    },
  });
});

test('mutate - patches keep the values of a moved draft after later updates', () => {
  const baseState: { item: { tags: string[] }; list: { tags: string[] }[] } = {
    item: { tags: ['a'] },
    list: [],
  };
  const { patches, inversePatches } = mutate(baseState, (draft) => {
    draft.list.push(draft.item);
  });
  expect(baseState).toEqual({ item: { tags: ['a'] }, list: [{ tags: ['a'] }] });
  expect(baseState.list[0]).not.toBe(baseState.item);
  mutate(baseState, (draft) => {
    draft.item.tags.push('b');
  });
  expect(patches).toEqual([
    { op: 'add', path: ['list', 0], value: { tags: ['a'] } },
  ]);
  apply(baseState, inversePatches);
  expect(baseState).toEqual({ item: { tags: ['a', 'b'] }, list: [] });
  apply(baseState, patches);
  expect(baseState).toEqual({
    item: { tags: ['a', 'b'] },
    list: [{ tags: ['a'] }],
  });
});

test('mutate - patches keep the unchanged values of a changed draft after later updates', () => {
  const baseState: {
    item: { done: boolean; tags: string[] };
    list: { done: boolean; tags: string[] }[];
  } = {
    item: { done: false, tags: ['a'] },
    list: [],
  };
  const { patches } = mutate(baseState, (draft) => {
    const { item } = draft;
    item.done = true;
    draft.list.push(item);
  });
  expect(baseState).toEqual({
    item: { done: true, tags: ['a'] },
    list: [{ done: true, tags: ['a'] }],
  });
  mutate(baseState, (draft) => {
    draft.item.tags.push('b');
  });
  expect(patches).toContainEqual({
    op: 'add',
    path: ['list', 0],
    value: { done: true, tags: ['a'] },
  });
});

test('mutate - a recipe that returns a new state throws', () => {
  // Development builds of Mutative also suggest rawReturn() for the new state.
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  const baseState = { a: { c: 1 } };
  expect(() => mutate(baseState, () => ({ a: { c: 2 } }))).toThrow();
  expect(baseState).toEqual({ a: { c: 1 } });
  warn.mockRestore();
});

test('apply - a patch that replaces the root state throws', () => {
  const baseState = { a: { c: 1 } };
  expect(() =>
    apply(baseState, [
      { op: 'replace', path: [], value: { a: { c: 2 } } },
      { op: 'replace', path: ['a', 'c'], value: 3 },
    ])
  ).toThrow();
  expect(baseState).toEqual({ a: { c: 1 } });
});
