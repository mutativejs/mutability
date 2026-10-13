import {
  create,
  apply as baseApply,
  isDraftable,
  type Patch,
  type Patches,
} from 'mutative';

const { hasOwnProperty, propertyIsEnumerable } = Object.prototype;

type Entries = Record<PropertyKey, unknown>;

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
const isEqual = (value: unknown, other: unknown): boolean => {
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
    // Match each item with an item of the other Set that no item matched yet.
    const otherItems = Array.from(other);
    return Array.from(value).every((item) => {
      const index = otherItems.findIndex((otherItem) =>
        isEqual(item, otherItem)
      );
      if (index < 0) return false;
      otherItems.splice(index, 1);
      return true;
    });
  }
  if (
    other instanceof Map ||
    other instanceof Set ||
    Array.isArray(value) !== Array.isArray(other) ||
    (Array.isArray(value) && value.length !== (other as unknown[]).length)
  ) {
    return false;
  }
  const object = value as Entries;
  const otherObject = other as Entries;
  const keys = getKeys(object);
  return (
    keys.length === getKeys(otherObject).length &&
    keys.every(
      (key) =>
        hasOwnProperty.call(otherObject, key) &&
        isEqual(object[key], otherObject[key])
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
const read = (target: unknown, key: unknown) => {
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
    ? (items as Entries)[key]
    : undefined;
};

const getParent = (state: object, patch: Patch) =>
  getPath(patch).slice(0, -1).reduce<unknown>(read, state);

const getIndex = (patch: Patch<true>) => patch.path[patch.path.length - 1];

/**
 * Whether the patch sets an element of the array to `undefined` where the
 * array of the state is empty.
 */
const isHole = (patch: Patch<true>, array: unknown): array is unknown[] => {
  const index = getIndex(patch);
  return (
    patch.op !== 'remove' &&
    patch.value === undefined &&
    Array.isArray(array) &&
    typeof index === 'number' &&
    index < array.length &&
    !(index in array)
  );
};

/**
 * Replace the consecutive patches that set the last elements of an array to
 * `undefined`, where the array of the state is empty, with patches of its
 * `length`, which leave those elements empty. A patch value cannot tell an
 * empty element from `undefined`, so the other empty elements become
 * `undefined`.
 */
const setHolesByLength = (patches: Patches<true>, state: object) => {
  const result: Patches<true> = [];
  for (let start = 0; start < patches.length; start += 1) {
    const patch = patches[start];
    const array = getParent(state, patch);
    if (!isHole(patch, array)) {
      result.push(patch);
      continue;
    }
    let end = start;
    while (
      end + 1 < patches.length &&
      getParent(state, patches[end + 1]) === array &&
      isHole(patches[end + 1], array) &&
      getIndex(patches[end + 1]) === Number(getIndex(patches[end])) + 1
    ) {
      end += 1;
    }
    const holes = patches.slice(start, end + 1);
    const path = [...patch.path.slice(0, -1), 'length'];
    const length = Number(getIndex(patches[end])) + 1;
    if (holes.every(({ op }) => op === 'add')) {
      // The patches append the elements.
      result.push({ op: 'replace', path, value: length });
    } else if (length === array.length) {
      // Shorten the array before the first element, then lengthen it again.
      result.push(
        { op: 'replace', path, value: getIndex(patch) },
        { op: 'replace', path, value: length }
      );
    } else {
      result.push(...holes);
    }
    start = end;
  }
  return result;
};

/**
 * Order the consecutive patches that add items to the same Set by ascending
 * index, and those that remove items from it by descending index, so that each
 * patch finds its item at its index once the patches before it apply. Mutative
 * lists the patches that remove items by ascending index, and the inverse
 * patches that add them back by descending index.
 */
const sortSetItems = (patches: Patches<true>, state: object) => {
  const sortedPatches: Patches<true> = [];
  let setPatches: Patches<true> = [];
  let set: unknown;
  let op: unknown;
  const addSorted = () => {
    const order = op === 'add' ? 1 : -1;
    setPatches.sort(
      (a, b) => order * (Number(getIndex(a)) - Number(getIndex(b)))
    );
    sortedPatches.push(...setPatches);
    setPatches = [];
  };
  patches.forEach((patch) => {
    const parent =
      patch.op === 'add' || patch.op === 'remove'
        ? getParent(state, patch)
        : undefined;
    if (parent !== set || patch.op !== op) addSorted();
    set = parent instanceof Set ? parent : undefined;
    op = patch.op;
    if (set) {
      setPatches.push(patch);
    } else {
      sortedPatches.push(patch);
    }
  });
  addSorted();
  return sortedPatches;
};

/**
 * Remove the item of the Set at the index of the patch if it equals the value,
 * as the Set holds a copy of a value that a patch added, or else the item that
 * is the value, or else the first item that equals it.
 */
const removeItem = (set: Set<unknown>, patch: Patch) => {
  const items = Array.from(set);
  const path = getPath(patch);
  const index = Number(path[path.length - 1]);
  if (index in items && isEqual(items[index], patch.value)) {
    set.delete(items[index]);
    return;
  }
  if (set.delete(patch.value)) return;
  const position = items.findIndex((item) => isEqual(item, patch.value));
  if (position >= 0) set.delete(items[position]);
};

/**
 * Add copies of the values of the patches to the Set, one after another, each
 * at the index of its path, as a patch adds an array element.
 */
const addItems = (set: Set<unknown>, patches: Patch[]) => {
  const items = Array.from(set);
  let isAppended = true;
  patches.forEach((patch) => {
    const value = copy(patch.value);
    if (items.includes(value)) return;
    const path = getPath(patch);
    const index = Number(path[path.length - 1]);
    const position =
      Number.isInteger(index) && index >= 0 && index < items.length
        ? index
        : items.length;
    isAppended = isAppended && position === items.length;
    items.splice(position, 0, value);
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
const applyInPlace = (state: object, allPatches: Patches) => {
  // As apply() does, apply the patches after the last one that replaces the
  // root state, which can only replace it with the state itself.
  let start = allPatches.length - 1;
  while (start >= 0 && !isRootReplacement(allPatches[start])) start -= 1;
  if (start >= 0 && allPatches[start].value !== state) {
    // apply() throws for a new root state before it changes the state.
    baseApply(state, allPatches, { mutable: true });
    return;
  }
  const patches = allPatches.slice(start + 1);
  // The patches that apply() applies together, until a patch may change a Set.
  let pending: Patches = [];
  const applyPending = () => {
    if (!pending.length) return;
    baseApply(state, pending, { mutable: true });
    pending = [];
  };
  for (let index = 0; index < patches.length; index += 1) {
    const patch = patches[index];
    let parent: unknown;
    // Only an `add` or a `remove` patch changes the items of a Set, which the
    // patch finds once the patches before it are applied.
    if (patch.op === 'add' || patch.op === 'remove') {
      applyPending();
      parent = getParent(state, patch);
    }
    if (!(parent instanceof Set)) {
      pending.push(patch);
    } else if (patch.op === 'remove') {
      removeItem(parent, patch);
    } else {
      // Add the items of consecutive patches together, to rebuild the Set once.
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
  const appliedPatches = sortSetItems(
    setHolesByLength(patches, nextState),
    baseState
  );
  const appliedInversePatches = sortSetItems(
    setHolesByLength(inversePatches, baseState),
    nextState
  );
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
