**mutability**

***

# mutability

![Node CI](https://github.com/mutativejs/mutability/workflows/Node%20CI/badge.svg)
[![npm version](https://badge.fury.io/js/mutability.svg)](http://badge.fury.io/js/mutability)
![license](https://img.shields.io/npm/l/mutability)

A JavaScript library for transactional mutable updates based on [Mutative](https://github.com/unadlib/mutative).

## Motivation

When we want to perform transactional updates on a mutable object, if an error is caught during the update process, the mutable update will not be applied at all. Otherwise, the mutable update will be applied to the mutable object. Therefore, we need a tool to implement this functionality.

## Installation

Mutability requires [Mutative](https://github.com/unadlib/mutative) 2 as a peer dependency.

```sh
yarn add mutative mutability
```

or with npm

```sh
npm install mutative mutability
```

## Usage

```ts
import { mutate, apply } from 'mutability';

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
```

## APIs

### `mutate()`

Mutate the mutable object with the recipe, and return the patches and inverse patches. If the recipe throws, the mutable object stays unchanged.

The recipe changes the draft. It cannot return a new state, since `mutate()` changes the mutable object in place, and `mutate()` throws if it does. The values of the returned patches and inverse patches are copies, so later updates of the mutable object do not change them.

### `apply()`

Apply the patches to the mutable object in place, for example the inverse patches that `mutate()` returned, to undo its update. It throws for a patch that replaces the root state.

## Notes

- `apply()` copies the patch values that it adds to the mutable object, also when `mutate()` applies them. So an object that the recipe moves, for example with `sort()`, is a copy in the mutable object.
- As a Set holds a copy of an object that a patch added, `apply()` removes the item that equals the value of a patch, and adds an item at the position that its patch records, so that undo and redo keep the items of a Set and their order.
- An array element that the recipe leaves empty, for example with a longer `length`, stays empty, also when undo and redo apply its patches: the patch that `mutate()` returns for it has no `value`, which Mutative's `apply()` sets as `undefined`.
- A Map patch records a key but no position, so undo adds a key that the recipe deleted from a Map back at the end of the Map. Later patches find Map entries by their keys, so they still apply.

## Upgrading to Mutative 2

Mutability 2 depends on Mutative 2. The [migration guide of Mutative](https://mutative.js.org/docs/advanced-guides/migration-v2) lists all of its changes; with Mutability, expect these:

- The patches of a nested draft come before those of its parents, as in Immer, so tests that pin patches may need updates. Applying them gives the same state.
- A recipe that returns a new state throws, and so does `apply()` for a patch that replaces the root state. Both leave the mutable object unchanged; Mutability 1 ignored the new state.
- `mutate()` applies changes below an object key of a Map, and changes between `0` and `-0` in an array, which Mutability 1 failed to apply.
- Production builds of Mutative throw `Minified Mutative error #<code>` instead of the full message, so run your tests with `NODE_ENV=production` too.
- Development builds of Mutative check recipes more strictly. For example, passing a draft as a key to the `set()` method of a Map draft throws, and the value and entry iterators of a Map draft, and the iterators of a Set draft, throw once `mutate()` returns.

## License

Mutability is [MIT licensed](https://github.com/mutativejs/mutability/blob/main/LICENSE).
