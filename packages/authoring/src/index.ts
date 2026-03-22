export interface AuthoringPatch {
  id: string;
  label: string;
  path: (string | number)[];
  previousValue: unknown;
  nextValue: unknown;
  timestamp: string;
  undoGroupId: string;
}

function cloneValue<T>(value: T): T {
  return structuredClone(value);
}

export function pathToKey(path: (string | number)[]): string {
  return path.map((part) => `${part}`).join('.');
}

export function getValueAtPath(document: unknown, path: (string | number)[]): unknown {
  return path.reduce<unknown>((current, segment) => {
    if (current === null || current === undefined) {
      return undefined;
    }

    return (current as Record<string | number, unknown>)[segment];
  }, document);
}

export function setValueAtPath<T>(document: T, path: (string | number)[], value: unknown): T {
  if (path.length === 0) {
    return cloneValue(value) as T;
  }

  const [head, ...tail] = path;
  const root = Array.isArray(document) ? [...document] : { ...(document as Record<string, unknown>) };

  if (tail.length === 0) {
    (root as Record<string | number, unknown>)[head] = cloneValue(value);
    return root as T;
  }

  const current = (root as Record<string | number, unknown>)[head];
  (root as Record<string | number, unknown>)[head] = setValueAtPath(
    current ?? (typeof tail[0] === 'number' ? [] : {}),
    tail,
    value
  );

  return root as T;
}

export function createPatch(
  document: unknown,
  path: (string | number)[],
  nextValue: unknown,
  label: string,
  undoGroupId = crypto.randomUUID()
): AuthoringPatch {
  return {
    id: crypto.randomUUID(),
    label,
    path,
    previousValue: cloneValue(getValueAtPath(document, path)),
    nextValue: cloneValue(nextValue),
    timestamp: new Date().toISOString(),
    undoGroupId
  };
}

export function applyPatch<T>(document: T, patch: AuthoringPatch): T {
  return setValueAtPath(document, patch.path, patch.nextValue);
}

export function revertPatch<T>(document: T, patch: AuthoringPatch): T {
  return setValueAtPath(document, patch.path, patch.previousValue);
}

export function applyPatches<T>(document: T, patches: AuthoringPatch[]): T {
  return patches.reduce((current, patch) => applyPatch(current, patch), cloneValue(document));
}
