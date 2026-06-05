import { inspectSchema, transform } from '../tools';

describe('inspectSchema', () => {
    it('returns empty schema for empty rows', () => {
        expect(inspectSchema([])).toEqual({ columns: [], rowCount: 0 });
    });

    it('returns correct rowCount', () => {
        const rows = [{ a: '1' }, { a: '2' }, { a: '3' }];
        expect(inspectSchema(rows).rowCount).toBe(3);
    });

    it('infers string type', () => {
        const rows = [{ name: 'Alice' }, { name: 'Bob' }];
        const { columns } = inspectSchema(rows);
        expect(columns[0]).toMatchObject({ name: 'name', type: 'string', nullCount: 0 });
    });

    it('infers number type', () => {
        const rows = [{ age: '30' }, { age: '25' }];
        const { columns } = inspectSchema(rows);
        expect(columns[0].type).toBe('number');
    });

    it('infers boolean type', () => {
        const rows = [{ active: 'true' }, { active: 'false' }];
        const { columns } = inspectSchema(rows);
        expect(columns[0].type).toBe('boolean');
    });

    it('counts null/empty values', () => {
        const rows = [
            { city: 'NYC' },
            { city: '' },
            { city: '' },
        ];
        const { columns } = inspectSchema(rows);
        expect(columns[0].nullCount).toBe(2);
    });

    it('falls back to string when types are mixed', () => {
        const rows = [{ val: '42' }, { val: 'hello' }];
        const { columns } = inspectSchema(rows);
        expect(columns[0].type).toBe('string');
    });
});

describe('transform: dedupe', () => {
    it('removes exact duplicate rows', () => {
        const rows = [{ a: '1', b: '2' }, { a: '1', b: '2' }, { a: '3', b: '4' }];
        expect(transform({ rows, operation: 'dedupe' })).toHaveLength(2);
    });

    it('keeps all rows when none are duplicated', () => {
        const rows = [{ a: '1' }, { a: '2' }];
        expect(transform({ rows, operation: 'dedupe' })).toHaveLength(2);
    });

    it('preserves first occurrence order', () => {
        const rows = [{ a: '1' }, { a: '2' }, { a: '1' }];
        expect(transform({ rows, operation: 'dedupe' })[0]).toEqual({ a: '1' });
    });
});

describe('transform: drop_nulls', () => {
    it('removes rows with empty string values', () => {
        const rows = [{ a: '1', b: '' }, { a: '2', b: '3' }];
        expect(transform({ rows, operation: 'drop_nulls' })).toEqual([{ a: '2', b: '3' }]);
    });

    it('keeps rows where all values are present', () => {
        const rows = [{ a: '1', b: '2' }];
        expect(transform({ rows, operation: 'drop_nulls' })).toHaveLength(1);
    });

    it('removes rows with empty values in any column', () => {
        const rows = [
            { a: '1', b: '2', c: '3' },
            { a: '1', b: '', c: '3' },
        ];
        expect(transform({ rows, operation: 'drop_nulls' })).toHaveLength(1);
    });
});

describe('transform: rename_columns', () => {
    it('renames specified columns', () => {
        const rows = [{ old_name: 'Alice', age: '30' }];
        const result = transform({ rows, operation: 'rename_columns', options: { old_name: 'name' } });
        expect(result[0]).toHaveProperty('name', 'Alice');
        expect(result[0]).not.toHaveProperty('old_name');
    });

    it('leaves unspecified columns unchanged', () => {
        const rows = [{ a: '1', b: '2' }];
        const result = transform({ rows, operation: 'rename_columns', options: { a: 'x' } });
        expect(result[0]).toHaveProperty('b', '2');
    });

    it('handles multiple renames at once', () => {
        const rows = [{ a: '1', b: '2' }];
        const result = transform({ rows, operation: 'rename_columns', options: { a: 'x', b: 'y' } });
        expect(result[0]).toEqual({ x: '1', y: '2' });
    });

    it('throws when options are missing', () => {
        expect(() => transform({ rows: [{ a: '1' }], operation: 'rename_columns' })).toThrow();
    });
});
