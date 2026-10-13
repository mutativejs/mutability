import { create, apply as baseApply, type Patches } from 'mutative';

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
  const [, appliedPatches, inversePatches] = create(baseState, recipe, {
    enablePatches: true,
  });
  // A patch value holds objects of the next state, which shares the objects
  // that the recipe did not change with the base state, and an inverse patch
  // value holds objects of the base state, which a patch of a nested draft
  // changes in place before a patch of its parent replaces them. Return
  // copies, so that no update of the base state in place changes the patches.
  const result = {
    inversePatches: copyValues(inversePatches),
    patches: copyValues(appliedPatches),
  };
  baseApply(baseState, appliedPatches, { mutable: true });
  return result;
};

/**
 * Apply the patches to the base state in place.
 */
export const apply = <T extends object>(baseState: T, patches: Patches) => {
  baseApply(baseState, patches, { mutable: true });
};
