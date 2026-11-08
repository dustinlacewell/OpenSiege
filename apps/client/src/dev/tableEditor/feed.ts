// A list of listeners that a value is sent to, in the order they subscribed. Pure.

export interface Feed<T> {
  subscribe(listener: (value: T) => void): void;
  emit(value: T): void;
}

export function createFeed<T>(): Feed<T> {
  const listeners: ((value: T) => void)[] = [];
  return {
    subscribe: (listener) => void listeners.push(listener),
    emit: (value) => listeners.forEach((l) => l(value)),
  };
}
