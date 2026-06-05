import { runAgent } from '../agent';

jest.mock('node-fetch');
import fetch from 'node-fetch';

const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

function ollamaReply(toolCalls?: { name: string; arguments: Record<string, unknown> }[]) {
    return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
            message: {
                role: 'assistant',
                content: '',
                ...(toolCalls ? { tool_calls: toolCalls.map(tc => ({ function: tc })) } : {}),
            },
        }),
    } as any);
}

const schema = { columns: [{ name: 'a', type: 'string' as const, nullCount: 0 }], rowCount: 2 };
const rows = [{ a: '1' }, { a: '2' }];

beforeEach(() => mockFetch.mockReset());

describe('runAgent', () => {
    it('returns rows unchanged when LLM calls finish immediately', async () => {
        mockFetch.mockResolvedValueOnce(ollamaReply([{ name: 'finish', arguments: {} }]) as any);
        const result = await runAgent(schema, rows);
        expect(result).toEqual(rows);
    });

    it('returns rows unchanged when LLM makes no tool calls', async () => {
        mockFetch.mockResolvedValueOnce(ollamaReply() as any);
        const result = await runAgent(schema, rows);
        expect(result).toEqual(rows);
    });

    it('applies dedupe when LLM calls dedupe', async () => {
        const dupeRows = [{ a: '1' }, { a: '1' }, { a: '2' }];
        mockFetch
            .mockResolvedValueOnce(ollamaReply([{ name: 'dedupe', arguments: {} }]) as any)
            .mockResolvedValueOnce(ollamaReply([{ name: 'finish', arguments: {} }]) as any);
        const result = await runAgent(schema, dupeRows);
        expect(result).toHaveLength(2);
    });

    it('applies drop_nulls when LLM calls drop_nulls', async () => {
        const nullRows = [{ a: '1' }, { a: '' }];
        mockFetch
            .mockResolvedValueOnce(ollamaReply([{ name: 'drop_nulls', arguments: {} }]) as any)
            .mockResolvedValueOnce(ollamaReply([{ name: 'finish', arguments: {} }]) as any);
        const result = await runAgent(schema, nullRows);
        expect(result).toEqual([{ a: '1' }]);
    });

    it('applies rename_columns when LLM provides a valid mapping', async () => {
        mockFetch
            .mockResolvedValueOnce(ollamaReply([{ name: 'rename_columns', arguments: { mapping: { a: 'b' } } }]) as any)
            .mockResolvedValueOnce(ollamaReply([{ name: 'finish', arguments: {} }]) as any);
        const result = await runAgent(schema, rows);
        expect(result[0]).toHaveProperty('b');
        expect(result[0]).not.toHaveProperty('a');
    });

    it('feeds error back to LLM instead of throwing when rename_columns has no mapping', async () => {
        const onStep = jest.fn();
        mockFetch
            .mockResolvedValueOnce(ollamaReply([{ name: 'rename_columns', arguments: {} }]) as any)
            .mockResolvedValueOnce(ollamaReply([{ name: 'finish', arguments: {} }]) as any);
        await expect(runAgent(schema, rows, onStep)).resolves.toBeDefined();
        // Second Ollama call should have received a tool result with success: false
        const secondCallBody = JSON.parse((mockFetch.mock.calls[1][1] as any).body);
        const toolMsg = secondCallBody.messages.find((m: any) => m.role === 'tool');
        expect(JSON.parse(toolMsg.content)).toMatchObject({ success: false });
    });

    it('stops after 10 turns if finish is never called', async () => {
        mockFetch.mockResolvedValue(ollamaReply([{ name: 'dedupe', arguments: {} }]) as any);
        const result = await runAgent(schema, rows);
        expect(mockFetch).toHaveBeenCalledTimes(10);
        expect(result).toBeDefined();
    });

    it('throws when Ollama returns a non-ok response', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: false,
            status: 500,
            text: () => Promise.resolve('internal error'),
        } as any);
        await expect(runAgent(schema, rows)).rejects.toThrow('Ollama request failed');
    });

    it('calls onStep callback for each tool invocation', async () => {
        const onStep = jest.fn().mockResolvedValue(undefined);
        mockFetch
            .mockResolvedValueOnce(ollamaReply([{ name: 'dedupe', arguments: {} }, { name: 'drop_nulls', arguments: {} }]) as any)
            .mockResolvedValueOnce(ollamaReply([{ name: 'finish', arguments: {} }]) as any);
        await runAgent(schema, rows, onStep);
        expect(onStep).toHaveBeenCalledWith('transform: dedupe');
        expect(onStep).toHaveBeenCalledWith('transform: drop_nulls');
    });
});
