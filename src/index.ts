import { create, apply as baseApply, type Patches } from 'mutative';

/**
 * Copy a value deeply, as `apply()` copies a patch value before applying it.
 */
const copy = <T>(value: T): T => {
  const target: { value?: T } = {};
  baseApply(target, [{ op: 'add', path: ['value'], value }], { mutable: true });
  return target.value as T;
};

/**
 * Transactional updates to the base state with the recipe.
 */
export const mutate = <T extends object>(
  baseState: T,
  recipe: (state: T) => void
) => {
  const [, patches, inversePatches] = create(baseState, recipe, {
    enablePatches: true,
  });
  // A patch value holds the objects of the next state, which shares the
  // objects that the recipe did not change with the base state. Return copies,
  // so that later updates of the base state in place do not change the patches.
  // The inverse patches hold the values that the patches replace or remove,
  // which leave the base state.
  const returnedPatches: Patches<true> = patches.map((patch) =>
    typeof patch.value === 'object' && patch.value !== null
      ? { ...patch, value: copy(patch.value) }
      : patch
  );
  baseApply(baseState, patches, { mutable: true });
  return { inversePatches, patches: returnedPatches };
};

export const apply = <T extends object>(baseState: T, patches: Patches) => {
  baseApply(baseState, patches, { mutable: true });
};
