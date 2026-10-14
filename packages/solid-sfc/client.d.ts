declare module '*.solid' {
  const component: import('solid-js').Component<any>;
  export default component;
}

declare namespace SolidSFC {
  type Accessor<T> = import('solid-js').Accessor<T>;
  type Setter<T> = import('solid-js').Setter<T>;
  type Element = import('solid-js').JSX.Element;
  type Component<P> = import('solid-js').Component<P>;

  type SignalOptions<T> = {
    equals?: false | ((prev: T, next: T) => boolean);
    name?: string;
    internal?: boolean;
  };

  type MemoOptions<T> = {
    equals?: false | ((prev: T, next: T) => boolean);
    name?: string;
  };

  interface Observable<T> {
    subscribe(
      observer: import('solid-js').ObservableObserver<T>,
    ): { unsubscribe(): void } | (() => void);
  }
}

// Compile-time functions. They only exist in `.solid` files, where the
// compiler replaces them with SolidJS calls.

/** Returns the props of the component. */
declare function $props<T = Record<string, any>>(): T;

// Reactive variables
declare function $signal<T>(): T | undefined;
declare function $signal<T>(value: T, options?: SolidSFC.SignalOptions<T>): T;
declare function $memo<T>(value: T, options?: SolidSFC.MemoOptions<T>): T;
/** A memo in a variable declaration. An effect in a statement. */
declare function $<T>(value: T): T;
declare function $deferred<T>(
  source: T,
  options?: SolidSFC.MemoOptions<T> & { timeoutMs?: number },
): T;
declare function $destructure<T>(value: T): T;
declare function $children(value: SolidSFC.Element): SolidSFC.Element;
declare function $mapArray<T, U>(
  list: readonly T[] | undefined | null | false,
  mapFn: (value: T, index: SolidSFC.Accessor<number>) => U,
  options?: { fallback?: SolidSFC.Accessor<any> },
): U[];
declare function $indexArray<T, U>(
  list: readonly T[] | undefined | null | false,
  mapFn: (value: SolidSFC.Accessor<T>, index: number) => U,
  options?: { fallback?: SolidSFC.Accessor<any> },
): U[];
declare function $from<T>(
  producer: SolidSFC.Observable<T> | ((setter: SolidSFC.Setter<T>) => () => void),
): T;

// References to reactive variables
declare function $derefSignal<T>(value: [SolidSFC.Accessor<T>, SolidSFC.Setter<T>]): T;
declare function $refSignal<T>(value: T): [SolidSFC.Accessor<T>, SolidSFC.Setter<T>];
declare function $derefMemo<T>(value: SolidSFC.Accessor<T>): T;
declare function $refMemo<T>(value: T): SolidSFC.Accessor<T>;
declare function $get<T>(value: T): SolidSFC.Accessor<T>;
declare function $set<T>(value: T): SolidSFC.Setter<T>;
declare function $getter<T>(value: T): T;
declare function $setter<T>(value: T): T;
declare function $property<T>(value: T): T;

// Functions with an implicit arrow function
declare function $untrack<T>(value: T): T;
declare function $batch<T>(value: T): T;
declare function $root<T>(value: T | ((dispose: () => void) => T)): T;
declare function $selector<T, U>(
  source: T,
  fn?: (a: U, b: T) => boolean,
  options?: { name?: string },
): (key: U) => boolean;
declare function $on<T, U>(
  deps: T,
  fn: (input: T, prevInput: T | undefined, prevValue?: U) => U,
  options?: { defer?: boolean },
): (prevValue?: U) => U;
declare function $observable<T>(value: T): SolidSFC.Observable<T>;
declare function $lazy<T extends import('solid-js').Component<any>>(
  module: Promise<{ default: T }>,
): T & { preload: () => Promise<{ default: T }> };

// Aliases
declare const $effect: typeof import('solid-js').createEffect;
declare const $computed: typeof import('solid-js').createComputed;
declare const $renderEffect: typeof import('solid-js').createRenderEffect;
declare const $merge: typeof import('solid-js').mergeProps;
declare const $uid: typeof import('solid-js').createUniqueId;
declare const $createContext: typeof import('solid-js').createContext;
declare const $useContext: typeof import('solid-js').useContext;
declare const $resource: typeof import('solid-js').createResource;
declare const $reaction: typeof import('solid-js').createReaction;
declare const $mount: typeof import('solid-js').onMount;
declare const $cleanup: typeof import('solid-js').onCleanup;
declare const $error: typeof import('solid-js').onError;
declare const $catchError: typeof import('solid-js').catchError;
declare const $startTransition: typeof import('solid-js').startTransition;
declare const $useTransition: typeof import('solid-js').useTransition;
declare const $owner: typeof import('solid-js').getOwner;
declare const $runWithOwner: typeof import('solid-js').runWithOwner;
declare const $store: typeof import('solid-js/store').createStore;
declare const $mutable: typeof import('solid-js/store').createMutable;
declare const $produce: typeof import('solid-js/store').produce;
declare const $reconcile: typeof import('solid-js/store').reconcile;
declare const $unwrap: typeof import('solid-js/store').unwrap;

// Components that are imported automatically
declare const For: typeof import('solid-js').For;
declare const Show: typeof import('solid-js').Show;
declare const Switch: typeof import('solid-js').Switch;
declare const Match: typeof import('solid-js').Match;
declare const Index: typeof import('solid-js').Index;
declare const ErrorBoundary: typeof import('solid-js').ErrorBoundary;
declare const Suspense: typeof import('solid-js').Suspense;
declare const SuspenseList: typeof import('solid-js').SuspenseList;
declare const Dynamic: typeof import('solid-js/web').Dynamic;
declare const Portal: typeof import('solid-js/web').Portal;
declare const Assets: typeof import('solid-js/web').Assets;
declare const HydrationScript: typeof import('solid-js/web').HydrationScript;
declare const NoHydration: typeof import('solid-js/web').NoHydration;
