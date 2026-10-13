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

test('mutate - inverse patches keep the values that nested patches change in place', () => {
  const createList = () => [0, 1, 2].map((id) => ({ id, n: 0 }));
  const baseState = { list: createList() };
  const { patches, inversePatches } = mutate(baseState, (draft) => {
    draft.list[1].n = 1;
    draft.list.reverse();
  });
  const nextList = [
    { id: 2, n: 0 },
    { id: 1, n: 1 },
    { id: 0, n: 0 },
  ];
  expect(baseState.list).toEqual(nextList);
  apply(baseState, inversePatches);
  expect(baseState.list).toEqual(createList());
  apply(baseState, patches);
  expect(baseState.list).toEqual(nextList);
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

describe('mutate - array methods', () => {
  type Job = { id: number; attempts: number };
  const createJobs = () => [0, 1, 2, 3].map((id): Job => ({ id, attempts: 0 }));
  const recipes: [string, (jobs: Job[]) => void, number[]][] = [
    [
      'shift()',
      (jobs) => {
        jobs.shift();
      },
      [1, 2, 3],
    ],
    [
      'unshift()',
      (jobs) => {
        jobs.unshift({ id: 4, attempts: 0 });
      },
      [4, 0, 1, 2, 3],
    ],
    [
      'splice()',
      (jobs) => {
        jobs.splice(1, 2, { id: 4, attempts: 0 });
      },
      [0, 4, 3],
    ],
    [
      'reverse()',
      (jobs) => {
        jobs.reverse();
      },
      [3, 2, 1, 0],
    ],
    [
      'sort()',
      (jobs) => {
        jobs.sort((a, b) => b.id - a.id);
      },
      [3, 2, 1, 0],
    ],
    [
      'shift() and push()',
      (jobs) => {
        const job = jobs.shift()!;
        job.attempts += 1;
        jobs.push(job);
      },
      [1, 2, 3, 0],
    ],
  ];

  test.each(recipes)(
    '%s: the patches replay in both directions',
    (_, recipe, ids) => {
      const baseState = { jobs: createJobs() };
      const { patches, inversePatches } = mutate(baseState, (draft) => {
        recipe(draft.jobs);
      });
      const nextState = { jobs: baseState.jobs.map((job) => ({ ...job })) };
      expect(nextState.jobs.map(({ id }) => id)).toEqual(ids);
      apply(baseState, inversePatches);
      expect(baseState).toEqual({ jobs: createJobs() });
      apply(baseState, patches);
      expect(baseState).toEqual(nextState);
    }
  );

  test('the moved job keeps its change', () => {
    const baseState = { jobs: createJobs() };
    mutate(baseState, (draft) => {
      const job = draft.jobs.shift()!;
      job.attempts += 1;
      draft.jobs.push(job);
    });
    expect(baseState.jobs[3]).toEqual({ id: 0, attempts: 1 });
    expect(baseState.jobs.slice(0, 3)).toEqual(createJobs().slice(1));
  });
});

describe('mutate - fixes of Mutative 2', () => {
  test('a change below an object key of a Map applies to that key', () => {
    const owner = { id: 1 };
    const baseState = { tasks: new Map([[owner, { done: false }]]) };
    const { patches, inversePatches } = mutate(baseState, (draft) => {
      draft.tasks.get(owner)!.done = true;
    });
    expect(patches).toEqual([
      { op: 'replace', path: ['tasks', owner, 'done'], value: true },
    ]);
    expect(patches[0].path[1]).toBe(owner);
    expect(baseState.tasks.get(owner)).toEqual({ done: true });
    apply(baseState, inversePatches);
    expect(baseState.tasks.get(owner)).toEqual({ done: false });
  });

  test('array patches keep the sign of zero', () => {
    const baseState = { values: [0] };
    const { patches, inversePatches } = mutate(baseState, (draft) => {
      draft.values[0] = -0;
    });
    expect(Object.is(baseState.values[0], -0)).toBe(true);
    apply(baseState, inversePatches);
    expect(Object.is(baseState.values[0], 0)).toBe(true);
    apply(baseState, patches);
    expect(Object.is(baseState.values[0], -0)).toBe(true);
  });
});
