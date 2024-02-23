import { mutate } from '../src';

test('base - mutate', () => {
  const baseState = {
    a: {
      c: 1,
    },
  };
  mutate(baseState, (draft) => {
    draft.a.c = 2;
  });
  expect(baseState).toEqual({ a: { c: 2 } });
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
