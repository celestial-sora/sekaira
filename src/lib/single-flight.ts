// Share only an in-progress request. Reusing a settled result would show stale data
// when a client page remounts after a create, update, or sign-in.
export function singleFlight<T>(load: () => Promise<T>): () => Promise<T> {
  let pending: Promise<T> | null = null;
  return () => {
    if (pending) return pending;
    const request = load();
    pending = request;
    const clear = () => {
      if (pending === request) pending = null;
    };
    void request.then(clear, clear);
    return request;
  };
}
