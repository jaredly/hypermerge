export function joinSets<T>(sets: Set<T>[]): Set<T> {
  const total = ([] as T[]).concat(...sets.map(a => [...a]));
  return new Set(total);
}

export function notEmpty<TValue>(
  value: TValue | null | undefined
): value is TValue {
  return value !== null && value !== undefined;
}
