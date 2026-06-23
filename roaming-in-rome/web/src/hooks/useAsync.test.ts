import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useAsync } from './useAsync';

describe('useAsync', () => {
  it('starts loading then resolves to data', async () => {
    const { result } = renderHook(() => useAsync(() => Promise.resolve(42), []));

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toBe(42);
    expect(result.current.error).toBeNull();
  });

  it('captures an error message on rejection', async () => {
    const { result } = renderHook(() =>
      useAsync(() => Promise.reject(new Error('boom')), []),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('boom');
    expect(result.current.data).toBeNull();
  });

  it('does not apply a late result after unmount', async () => {
    let resolve!: (value: number) => void;
    const pending = new Promise<number>((r) => {
      resolve = r;
    });

    const { result, unmount } = renderHook(() => useAsync(() => pending, []));
    unmount();
    resolve(99);
    await pending;

    // The unmount guard means the resolved value is never written back.
    expect(result.current.data).toBeNull();
    expect(result.current.loading).toBe(true);
  });
});
