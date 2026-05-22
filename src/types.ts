export type ColumnSchema = {
    name: string
    type: 'string' | 'number' | 'boolean'
    nullCount: number
}

export type Schema = {
    columns: ColumnSchema[]
    rowCount: number
}

export type OperationType = 'dedupe' | 'drop_nulls' | 'rename_columns' | 'cast_types'

export type TransformOperation = {
    rows: Record<string, string>[],
    operation: OperationType,
    options?: Record<string, string>
}