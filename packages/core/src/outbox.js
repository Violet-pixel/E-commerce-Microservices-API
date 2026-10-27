export const startOutboxRelay = (options) => {
  const interval = options.intervalMs ?? 500;
  const batch = options.batchSize ?? 100;
  let stopped = false;
  let running = null;
  let wake = null;

  const tick = async () => {
    const rows = await options.store.pending(batch);
    const done = [];
    for (const row of rows) {
      await options.publisher.publishEnvelope(row.envelope);
      done.push(row.id);
    }
    if (done.length) await options.store.markPublished(done);
    return rows.length === batch;
  };

  const loop = async () => {
    while (!stopped) {
      let more = false;
      try {
        more = await tick();
      } catch (error) {
        options.onError?.(error);
      }
      if (!more && !stopped) {
        await new Promise((resolve) => {
          const timer = setTimeout(resolve, interval);
          wake = () => {
            clearTimeout(timer);
            resolve();
          };
        });
        wake = null;
      }
    }
  };

  running = loop();

  return {
    notify: () => wake?.(),
    stop: async () => {
      stopped = true;
      wake?.();
      await running;
    }
  };
};
