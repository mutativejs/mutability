[**mutability**](../README.md)

***

[mutability](../globals.md) / mutate

# Function: mutate()

> **mutate**\<`T`\>(`baseState`, `recipe`): `object`

Defined in: [index.ts:349](https://github.com/mutativejs/mutability/blob/1dab54657e9696828995505f9372d5ce96786ed4/src/index.ts#L349)

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
