type QueryLoader<T> = () => PromiseLike<T>

type QueryLoaderValue<TLoader> = TLoader extends QueryLoader<infer TValue> ? TValue : never

/** Runs read query factories in bounded batches and preserves their input order. */
export async function loadQueriesInBatches<const TLoaders extends readonly QueryLoader<unknown>[]>(
  loaders: TLoaders,
  batchSize: number,
): Promise<{ [Index in keyof TLoaders]: QueryLoaderValue<TLoaders[Index]> }> {
  if (!Number.isSafeInteger(batchSize) || batchSize < 1) {
    throw new RangeError('Query batch size must be a positive integer.')
  }

  const results: unknown[] = []
  for (let index = 0; index < loaders.length; index += batchSize) {
    const batch = loaders.slice(index, index + batchSize)
    const batchResults = await Promise.all(batch.map((load) => Promise.resolve(load())))
    results.push(...batchResults)
  }

  return results as { [Index in keyof TLoaders]: QueryLoaderValue<TLoaders[Index]> }
}
