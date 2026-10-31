import { Effect } from 'effect';

export class WaitTimeout extends Error {
  constructor(what: string, timeoutMs: number) {
    super(`${what} not found after ${timeoutMs} ms`);
    this.name = 'WaitTimeout';
  }
}

/**
 * Succeeds with the first non-null value `find` returns. It is tried right away and again after every change of the page,
 * so it works however long lichess takes to render. Fails with a `WaitTimeout` after `timeoutMs`.
 */
export const waitFor = <A>(what: string, find: () => A | null | undefined, timeoutMs: number, root: Node = document): Effect.Effect<A, WaitTimeout> =>
  Effect.callback<A, WaitTimeout>(resume => {
    const found = find();
    if (found != null) {
      resume(Effect.succeed(found));
      return;
    }

    const stop = () => {
      observer.disconnect();
      clearTimeout(timer);
    };
    const observer = new MutationObserver(() => {
      const value = find();
      if (value != null) {
        stop();
        resume(Effect.succeed(value));
      }
    });
    const timer = setTimeout(() => {
      stop();
      resume(Effect.fail(new WaitTimeout(what, timeoutMs)));
    }, timeoutMs);

    observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    return Effect.sync(stop);
  });

/** Lichess re-renders parts of the page, which can remove our panel. This puts `element` back into the container whenever that happens. */
export const keepAttached = (element: HTMLElement, findContainer: () => HTMLElement | null, root: Node = document.body): MutationObserver => {
  const observer = new MutationObserver(() => {
    if (!element.isConnected) {
      findContainer()?.prepend(element);
    }
  });
  observer.observe(root, { childList: true, subtree: true });
  return observer;
};
