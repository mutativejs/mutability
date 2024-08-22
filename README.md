# mutability

![Node CI](https://github.com/mutativejs/mutability/workflows/Node%20CI/badge.svg)
[![npm version](https://badge.fury.io/js/mutability.svg)](http://badge.fury.io/js/mutability)
![license](https://img.shields.io/npm/l/mutability)

A JavaScript library for transactional mutable updates based on [Mutative](https://github.com/unadlib/mutative).

## Motivation

When we want to perform transactional updates on a mutable object, if an error is caught during the update process, the mutable update will not be applied at all. Otherwise, the mutable update will be applied to the mutable object. Therefore, we need a tool to implement this functionality.

## Installation

```sh
yarn add mutative mutability
```

or with npm

```sh
npm install mutative mutability
```

## Usage

```ts
import { mutate } from 'mutability';

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
Mutate the mutable object, and return the patches and inverse patches.

### `apply()`
Apply the mutable update with patches.

## License

Mutability is [MIT licensed](https://github.com/mutativejs/mutability/blob/main/LICENSE).
