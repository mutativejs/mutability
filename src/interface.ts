export const Operation = {
  Remove: 'remove',
  Replace: 'replace',
  Add: 'add',
} as const;

export const enum DraftType {
  Object,
  Array,
  Map,
  Set,
}

interface Patch {
  op: (typeof Operation)[keyof typeof Operation];
  value?: any;
  path: string | (string | number)[];
}

export type Patches = Patch[];
