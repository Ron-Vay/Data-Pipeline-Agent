import fetch from 'node-fetch'
import { parse } from 'csv-parse/sync'
import { ColumnSchema, Schema, TransformOperation } from "./types";
import sql from "./db";

export async function fetchSource(url:string): Promise<string> {
    const res = await fetch(url);
    if (!res.ok) {
        throw new Error(`Failed to fetch source: ${url}`);
    }
    return res.text()
}

export function inspectSchema(raw:string): Schema {
    const rows: Record<string, string>[] = parse(raw, { columns: true, skip_empty_lines: true });
    if(rows.length === 0) return { columns: [], rowCount: 0 }
    const columnNames = Object.keys(rows[0])
    const columns: ColumnSchema[] = columnNames.map(name => {
        const values = rows.map(row => row[name])
        const nonNull = values.filter(v => v !== '' && v != null)
        const nullCount = values.length - nonNull.length

        let type: ColumnSchema['type'] = 'string'
        if (nonNull.every(value => !isNaN(Number(value)))) type = 'number'
        else if (nonNull.every(value => value === 'true' || value === 'false')) type = 'boolean'

        return { name, nullCount, type }
    })
    return { columns, rowCount: rows.length }
}

export function transform(input: TransformOperation): Record<string, string>[] {
    switch (input.operation) {
        case 'dedupe': {
            const seen = new Set<string>()
            return input.rows.filter(row => {
                const key = JSON.stringify(row)
                if (seen.has(key)) return false
                seen.add(key)
                return true
            })
        }
        case 'drop_nulls':
            return input.rows.filter(row =>
                Object.values(row).every(value => value !== '' && value != null)
            )
        case 'rename_columns': {
            if (!input.options) throw new Error('No options provided for rename_columns')
            return input.rows.map(row => {
                const newRow: Record<string, string> = {}
                for (const key of Object.keys(row)) {
                    newRow[input.options?.[key] ?? key] = row[key]
                }
                return newRow
            })
        }
        case 'cast_types':
        default:
            return input.rows
    }
}
export async function store(rows: Record<string, string>[], jobId: string): Promise<void> {
    for (const row of rows) {
        await sql`INSERT INTO pipeline_results (job_id, data) VALUES (${jobId}, ${sql.json(row)})`;
    }
}