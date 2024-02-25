import * as mutative from 'mutative';
import { apply } from './apply';

/**
 * Transactional updates to the base state with the recipe.
 */
export const mutate = <T>(baseState: T, recipe: (state: T) => void) => {
  const [, patches] = mutative.create(baseState, recipe, {
    enablePatches: true,
  });
  apply(baseState, patches);
};
