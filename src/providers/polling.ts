export interface PollOptions {
  timeoutMs: number;
  intervalMs: number;
  onPoll?: (attempt: number) => void;
}

export async function pollForCompletion<T>(
  checkStatus: () => Promise<T>,
  isComplete: (result: T) => boolean,
  options: PollOptions,
): Promise<T> {
  const startTime = Date.now();
  let attempt = 0;

  while (Date.now() - startTime < options.timeoutMs) {
    const result = await checkStatus();
    attempt++;
    options.onPoll?.(attempt);

    if (isComplete(result)) {
      return result;
    }

    await new Promise((resolve) => setTimeout(resolve, options.intervalMs));
  }

  throw new Error(`Generation timed out after ${options.timeoutMs / 1000} seconds`);
}
