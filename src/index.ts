import { create } from 'mutative';
import { apply } from './apply';

export const mutate = <T>(baseState: T, recipe: (state: T) => void) => {
  const [, patches] = create(baseState, recipe, {
    enablePatches: true,
  });
  apply(baseState, patches);
};
