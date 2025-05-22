import { create, apply as baseApply, Patches } from 'mutative';

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
  baseApply(baseState, patches, { mutable: true });
  return { inversePatches, patches };
};

export const apply = <T extends object>(baseState: T, patches: Patches) => {
  baseApply(baseState, patches, { mutable: true });
};
