import { create } from 'mutative';
import { apply } from './apply';

export { apply } from './apply';

/**
 * Transactional updates to the base state with the recipe.
 */
export const mutate = <T>(baseState: T, recipe: (state: T) => void) => {
  const [, patches] = create(baseState, recipe, {
    enablePatches: true,
  });
  apply(baseState, patches);
  return patches;
};
