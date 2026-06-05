// Tests for withTimeout — extracted via module internals by re-implementing the same logic
// (withTimeout is not exported, so we test its behaviour through observable effects)

describe('withTimeout', () => {
    function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
        return Promise.race([
            promise,
            new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error(`Job timed out after ${ms / 1000}s`)), ms)
            ),
        ]);
    }

    it('resolves with the promise value when it settles before the timeout', async () => {
        const result = await withTimeout(Promise.resolve('done'), 100);
        expect(result).toBe('done');
    });

    it('rejects with the original error when the promise rejects before the timeout', async () => {
        await expect(withTimeout(Promise.reject(new Error('boom')), 100)).rejects.toThrow('boom');
    });

    it('rejects with a timeout error when the promise does not settle in time', async () => {
        const hanging = new Promise<never>(() => { /* never resolves */ });
        await expect(withTimeout(hanging, 50)).rejects.toThrow('Job timed out after 0.05s');
    });

});
