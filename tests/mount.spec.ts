import { Effect } from 'effect';
import { afterEach, describe, expect, it } from 'vitest';
import { keepAttached, waitFor } from '@/challenge/mount';

afterEach(() => {
  document.body.innerHTML = '';
});

const byId = (id: string) => () => document.getElementById(id);

describe('waitFor', () => {
  it('should succeed right away if the element exists', async () => {
    document.body.innerHTML = '<div id="a"></div>';
    await expect(Effect.runPromise(waitFor('a', byId('a'), 1000))).resolves.toBe(document.getElementById('a'));
  });

  it('should wait for an element that is added later', async () => {
    const result = Effect.runPromise(waitFor('a', byId('a'), 1000));
    setTimeout(() => document.body.insertAdjacentHTML('beforeend', '<div id="a"></div>'), 20);
    expect(await result).toBe(document.getElementById('a'));
  });

  it('should also notice a changed class', async () => {
    document.body.innerHTML = '<div id="a"></div>';
    const rendered = () => (document.getElementById('a')?.className.includes('rendered') ? document.getElementById('a') : null);
    const result = Effect.runPromise(waitFor('a', rendered, 1000));
    setTimeout(() => document.getElementById('a')?.classList.add('rendered'), 20);
    expect(await result).toBe(document.getElementById('a'));
  });

  it('should fail after the timeout', async () => {
    await expect(Effect.runPromise(waitFor('the thing', byId('missing'), 30))).rejects.toThrow('the thing not found after 30 ms');
  });
});

describe('keepAttached', () => {
  it('should put the element back after the container was re-rendered', async () => {
    document.body.innerHTML = '<div id="container"></div>';
    const panel = document.createElement('div');
    document.getElementById('container')?.prepend(panel);
    const observer = keepAttached(panel, byId('container'));

    document.body.innerHTML = '<div id="container"><p>re-rendered</p></div>';
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(panel.isConnected).toBe(true);
    expect(document.getElementById('container')?.firstElementChild).toBe(panel);
    observer.disconnect();
  });
});
