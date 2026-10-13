[**mutability**](../README.md)

***

[mutability](../globals.md) / mutate

# Function: mutate()

> **mutate**\<`T`\>(`baseState`, `recipe`): `object`

Defined in: [index.ts:234](https://github.com/mutativejs/mutability/blob/f75d5b5cf31fb8b1b5f9ec570cc350fe2ecee9a0/src/index.ts#L234)

Transactional updates to the base state with the recipe.

Return the patches of the update and the inverse patches that undo it, whose
values are copies. If the recipe throws, the base state stays unchanged.

## Type Parameters

### T

`T` *extends* `object`

## Parameters

### baseState

`T`

### recipe

(`state`) => `void`

## Returns

`object`

### inversePatches

> **inversePatches**: `Patches`\<`true`\>

### patches

> **patches**: `Patches`\<`true`\>
