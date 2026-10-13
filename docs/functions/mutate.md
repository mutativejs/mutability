[**mutability**](../README.md) • **Docs**

***

[mutability](../globals.md) / mutate

# Function: mutate()

> **mutate**\<`T`\>(`baseState`, `recipe`): `object`

Transactional updates to the base state with the recipe.

Return the patches of the update, whose values are copies, and the inverse
patches that undo it. If the recipe throws, the base state stays unchanged.

## Type Parameters

• **T** *extends* `object`

## Parameters

• **baseState**: `T`

• **recipe**

## Returns

`object`

### inversePatches

> **inversePatches**: `Patches`\<`true`\>

### patches

> **patches**: `Patches`\<`true`\>

## Defined in

[index.ts:18](https://github.com/mutativejs/mutability/blob/9e0db430b659d638454d747046775e54adfa4f39/src/index.ts#L18)
