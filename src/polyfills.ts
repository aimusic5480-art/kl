if (typeof (Object as ObjectConstructor & { hasOwn?: (object: object, property: PropertyKey) => boolean }).hasOwn !== 'function') {
  Object.defineProperty(Object, 'hasOwn', {
    configurable: true,
    writable: true,
    value: (object: object, property: PropertyKey) =>
      Object.prototype.hasOwnProperty.call(object, property),
  });
}

const getAtIndex = (length: number, index: number): number | undefined => {
  const integer = Number.isNaN(index) ? 0 : Math.trunc(index);
  const relativeIndex = integer < 0 ? length + integer : integer;
  return relativeIndex < 0 || relativeIndex >= length ? undefined : relativeIndex;
};

const arrayPrototype = Array.prototype as unknown as {
  at?: (index: number) => unknown;
  findLast?: (predicate: (...args: never[]) => unknown) => unknown;
  findLastIndex?: (predicate: (...args: never[]) => unknown) => number;
};

if (typeof arrayPrototype.at !== 'function') {
  Object.defineProperty(Array.prototype, 'at', {
    configurable: true,
    writable: true,
    value<T>(this: T[], index: number): T | undefined {
      const relativeIndex = getAtIndex(this.length, index);
      return relativeIndex === undefined ? undefined : this[relativeIndex];
    },
  });
}

const stringPrototype = String.prototype as unknown as { at?: (index: number) => unknown };

if (typeof stringPrototype.at !== 'function') {
  Object.defineProperty(String.prototype, 'at', {
    configurable: true,
    writable: true,
    value(this: string, index: number): string | undefined {
      const characters = Array.from(this);
      const relativeIndex = getAtIndex(characters.length, index);
      return relativeIndex === undefined ? undefined : characters[relativeIndex];
    },
  });
}

if (typeof arrayPrototype.findLast !== 'function') {
  Object.defineProperty(Array.prototype, 'findLast', {
    configurable: true,
    writable: true,
    value<T>(this: T[], predicate: (value: T, index: number, array: T[]) => unknown): T | undefined {
      for (let index = this.length - 1; index >= 0; index -= 1) {
        if (predicate(this[index], index, this)) return this[index];
      }
      return undefined;
    },
  });
}

if (typeof arrayPrototype.findLastIndex !== 'function') {
  Object.defineProperty(Array.prototype, 'findLastIndex', {
    configurable: true,
    writable: true,
    value<T>(this: T[], predicate: (value: T, index: number, array: T[]) => unknown): number {
      for (let index = this.length - 1; index >= 0; index -= 1) {
        if (predicate(this[index], index, this)) return index;
      }
      return -1;
    },
  });
}

const typedArrayConstructors = [
  Int8Array,
  Uint8Array,
  Uint8ClampedArray,
  Int16Array,
  Uint16Array,
  Int32Array,
  Uint32Array,
  Float32Array,
  Float64Array,
  ...(typeof BigInt64Array === 'undefined' ? [] : [BigInt64Array]),
  ...(typeof BigUint64Array === 'undefined' ? [] : [BigUint64Array]),
];

for (const TypedArray of typedArrayConstructors) {
  const prototype = TypedArray.prototype as unknown as {
    at?: (index: number) => unknown;
    length: number;
    [index: number]: unknown;
  };
  if (!prototype.at) {
    Object.defineProperty(prototype, 'at', {
      configurable: true,
      writable: true,
      value(this: typeof prototype, index: number) {
        const relativeIndex = getAtIndex(this.length, index);
        return relativeIndex === undefined ? undefined : this[relativeIndex];
      },
    });
  }
}

if (typeof globalThis.structuredClone !== 'function') {
  Object.defineProperty(globalThis, 'structuredClone', {
    configurable: true,
    writable: true,
    value: <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T,
  });
}
