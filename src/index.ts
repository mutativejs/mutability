import {
  create,
  apply as baseApply,
  isDraftable,
  type Patch,
  type Patches,
} from 'mutative';

const { hasOwnProperty, propertyIsEnumerable } = Object.prototype;

/**
 * Copy a value deeply, as `apply()` copies a patch value before applying it.
 */
const copy = <T>(value: T): T => {
  const target: { value?: T } = {};
  baseApply(target, [{ op: 'add', path: ['value'], value }], { mutable: true });
  return target.value as T;
};

const copyValues = (patches: Patches<true>): Patches<true> =>
  patches.map((patch) =>
    typeof patch.value === 'object' && patch.value !== null
      ? { ...patch, value: copy(patch.value) }
      : patch
  );

const getKeys = (value: object) =>
  Reflect.ownKeys(value).filter((key) => propertyIsEnumerable.call(value, key));

/**
 * Whether a value equals another one as a copy that `apply()` makes of it:
 * plain objects, arrays, Maps and Sets by their items, other values by
 * identity.
 */
const isEqual = (value: any, other: any): boolean => {
  if (Object.is(value, other)) return true;
  if (!isDraftable(value) || !isDraftable(other)) return false;
  if (value instanceof Map) {
    if (!(other instanceof Map) || value.size !== other.size) return false;
    return Array.from(value).every(
      ([key, item]) => other.has(key) && isEqual(item, other.get(key))
    );
  }
  if (value instanceof Set) {
    if (!(other instanceof Set) || value.size !== other.size) return false;
    const otherItems = Array.from(other);
    return Array.from(value).every(
      (item) =>
        other.has(item) ||
        otherItems.some((otherItem) => isEqual(item, otherItem))
    );
  }
  if (
    other instanceof Map ||
    other instanceof Set ||
    Array.isArray(value) !== Array.isArray(other) ||
    (Array.isArray(value) && value.length !== other.length)
  ) {
    return false;
  }
  const keys = getKeys(value);
  return (
    keys.length === getKeys(other).length &&
    keys.every(
      (key) =>
        hasOwnProperty.call(other, key) && isEqual(value[key], other[key])
    )
  );
};

const getPath = ({ path }: Patch): unknown[] =>
  typeof path === 'string'
    ? path
        .split('/')
        .slice(1)
        .map((key) => key.replace(/~1/g, '/').replace(/~0/g, '~'))
    : path;

/**
 * Read the value at a key of a patch path, as `apply()` does. A key that
 * `apply()` may reject reads `undefined`, so that `apply()` handles the patch.
 */
const read = (target: any, key: unknown) => {
  if (target instanceof Map) return target.get(key);
  const items = target instanceof Set ? Array.from(target) : target;
  return typeof items === 'object' &&
    items !== null &&
    (typeof key === 'string' ||
      typeof key === 'number' ||
      typeof key === 'symbol') &&
    key !== '__proto__' &&
    key !== 'constructor' &&
    hasOwnProperty.call(items, key)
    ? items[key]
    : undefined;
};

const getParent = (state: object, patch: Patch) =>
  getPath(patch).slice(0, -1).reduce(read, state);

/**
 * Leave out the value of a patch that sets an array element to `undefined`
 * where the array of the state is empty, as a patch without a value makes a
 * hole in an array.
 */
const markHoles = (patches: Patches<true>, state: object): Patches<true> =>
  patches.map((patch) => {
    if (patch.op === 'remove' || patch.value !== undefined) return patch;
    const parent = getParent(state, patch);
    const index = patch.path[patch.path.length - 1];
    return Array.isArray(parent) &&
      typeof index === 'number' &&
      index < parent.length &&
      !(index in parent)
      ? { op: patch.op, path: patch.path }
      : patch;
  });

/**
 * Remove the item that is the value from the Set, or else the first item that
 * equals it, as the Set holds a copy of a value that a patch added.
 */
const removeItem = (set: Set<unknown>, value: unknown) => {
  if (set.delete(value)) return;
  for (const item of set) {
    if (isEqual(item, value)) {
      set.delete(item);
      return;
    }
  }
};

/**
 * Add copies of the values of the patches to the Set at the indices of their
 * paths, which are the positions of the items once all of them are added.
 */
const addItems = (set: Set<unknown>, patches: Patch[]) => {
  const items = Array.from(set);
  let isAppended = true;
  patches
    .map((patch) => {
      const path = getPath(patch);
      const index = Number(path[path.length - 1]);
      return {
        index: Number.isInteger(index) && index >= 0 ? index : Infinity,
        value: copy(patch.value),
      };
    })
    .sort((a, b) => a.index - b.index)
    .forEach(({ index, value }) => {
      if (items.includes(value)) return;
      isAppended = isAppended && index >= items.length;
      items.splice(Math.min(index, items.length), 0, value);
    });
  if (isAppended) {
    items.slice(set.size).forEach((item) => set.add(item));
  } else {
    set.clear();
    items.forEach((item) => set.add(item));
  }
};

const isRootReplacement = ({ op, path }: Patch) =>
  (op === 'replace' && !path.length) || (op === 'add' && path === '');

/**
 * Apply the patches to the state in place. `apply()` adds a copy of a patch
 * value at the end of a Set and removes only the item that is the value, so
 * the patches that add items to a Set or remove them are applied here, to
 * keep the items and their order through undo and redo.
 */
const applyInPlace = (state: object, patches: Patches) => {
  if (patches.some(isRootReplacement)) {
    // apply() throws for a new root state before it changes the state.
    baseApply(state, patches, { mutable: true });
    return;
  }
  // The patches that apply() applies together, until a patch may change a Set.
  let pending: Patches = [];
  const applyPending = () => {
    if (!pending.length) return;
    baseApply(state, pending, { mutable: true });
    pending = [];
  };
  for (let index = 0; index < patches.length; index += 1) {
    const patch = patches[index];
    const isHole = patch.op !== 'remove' && !('value' in patch);
    let parent: unknown;
    // Only an `add` or a `remove` patch changes the items of a Set, which the
    // patch finds once the patches before it are applied.
    if (patch.op === 'add' || patch.op === 'remove' || isHole) {
      applyPending();
      parent = getParent(state, patch);
    }
    if (!(parent instanceof Set)) {
      pending.push(patch);
      if (isHole && Array.isArray(parent)) {
        // apply() sets the element to `undefined`, which the hole replaces.
        applyPending();
        const path = getPath(patch);
        const key = Number(path[path.length - 1]);
        if (Number.isInteger(key)) delete parent[key];
      }
    } else if (patch.op === 'remove') {
      removeItem(parent, patch.value);
    } else {
      // The inverse patches add the items of a Set by descending index.
      const addPatches = [patch];
      while (
        index + 1 < patches.length &&
        patches[index + 1].op === 'add' &&
        getParent(state, patches[index + 1]) === parent
      ) {
        index += 1;
        addPatches.push(patches[index]);
      }
      addItems(parent, addPatches);
    }
  }
  applyPending();
};

/**
 * Transactional updates to the base state with the recipe.
 *
 * Return the patches of the update and the inverse patches that undo it, whose
 * values are copies. If the recipe throws, the base state stays unchanged.
 */
export const mutate = <T extends object>(
  baseState: T,
  recipe: (state: T) => void
) => {
  const [nextState, patches, inversePatches] = create(baseState, recipe, {
    enablePatches: true,
  });
  // A patch value cannot tell an empty array element from `undefined`.
  const appliedPatches = markHoles(patches, nextState);
  const appliedInversePatches = markHoles(inversePatches, baseState);
  // A patch value holds objects of the next state, which shares the objects
  // that the recipe did not change with the base state, and an inverse patch
  // value holds objects of the base state, which a patch of a nested draft
  // changes in place before a patch of its parent replaces them. Return
  // copies, so that no update of the base state in place changes the patches.
  const result = {
    inversePatches: copyValues(appliedInversePatches),
    patches: copyValues(appliedPatches),
  };
  applyInPlace(baseState, appliedPatches);
  return result;
};

/**
 * Apply the patches to the base state in place.
 */
export const apply = <T extends object>(baseState: T, patches: Patches) => {
  applyInPlace(baseState, patches);
};
