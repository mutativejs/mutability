import { DraftType } from './interface';

export function unescapePath(path: string | (string | number)[]) {
  if (Array.isArray(path)) return path;
  return path
    .split('/')
    .map((_item) => _item.replace(/~1/g, '/').replace(/~0/g, '~'))
    .slice(1);
}

export function getType(target: any) {
  if (Array.isArray(target)) return DraftType.Array;
  if (target instanceof Map) return DraftType.Map;
  if (target instanceof Set) return DraftType.Set;
  return DraftType.Object;
}

export function get(target: any, key: PropertyKey) {
  return getType(target) === DraftType.Map ? target.get(key) : target[key];
}

function deepClone<T>(target: T): T;
function deepClone(target: any) {
  if (typeof target !== 'object' || target === null) return target;
  if (Array.isArray(target)) return target.map(deepClone);
  if (target instanceof Map)
    return new Map(
      Array.from(target.entries()).map(([k, v]) => [k, deepClone(v)])
    );
  if (target instanceof Set) return new Set(Array.from(target).map(deepClone));
  const copy = Object.create(Object.getPrototypeOf(target));
  for (const key in target) copy[key] = deepClone(target[key]);
  return copy;
}

export { deepClone };
