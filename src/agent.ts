import fetch from 'node-fetch'
import { Schema } from './types'
import { transform } from './tools'

const OLLAMA_URL = process.env.OLLAMA_URL ?? 'http://localhost:11434'
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? 'llama3.2'

const SYSTEM_PROMPT = `You are a data transformation planning agent. You receive a CSV dataset schema and decide which cleaning transforms to apply.

Use the provided tools to clean the data in whatever order makes sense. Call finish() when you are done.

Guidelines:
- Call dedupe() if the data likely has duplicate rows
- Call drop_nulls() if columns with null/empty values should be required fields
- Call rename_columns() only if column names are clearly poor (e.g. cryptic abbreviations, inconsistent casing)
- Do not apply transforms that would remove an excessive portion of the data`

const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'dedupe',
      description: 'Remove duplicate rows from the dataset',
      parameters: { type: 'object', properties: {} }
    }
  },
  {
    type: 'function',
    function: {
      name: 'drop_nulls',
      description: 'Remove rows with any missing or empty values',
      parameters: { type: 'object', properties: {} }
    }
  },
  {
    type: 'function',
    function: {
      name: 'rename_columns',
      description: 'Rename one or more columns',
      parameters: {
        type: 'object',
        properties: {
          mapping: {
            type: 'object',
            description: 'Object mapping old column name to new column name',
            additionalProperties: { type: 'string' }
          }
        },
        required: ['mapping']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'finish',
      description: 'Signal that transformation planning is complete',
      parameters: { type: 'object', properties: {} }
    }
  }
]

type OllamaToolCall = {
  function: { name: string; arguments: Record<string, unknown> }
}

type OllamaMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  tool_calls?: OllamaToolCall[]
}

async function callOllama(messages: OllamaMessage[]): Promise<OllamaMessage> {
  const res = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: OLLAMA_MODEL, messages, tools: TOOLS, stream: false })
  })
  if (!res.ok) throw new Error(`Ollama request failed: ${res.status} ${await res.text()}`)
  const body = await res.json() as { message: OllamaMessage }
  return body.message
}

export async function runAgent(
  schema: Schema,
  rows: Record<string, string>[],
  onStep?: (status: string) => Promise<void>
): Promise<Record<string, string>[]> {
  const messages: OllamaMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    {
      role: 'user',
      content: `Schema:\n${JSON.stringify(schema, null, 2)}\n\nRow count: ${rows.length}\n\nPlease clean this dataset.`
    }
  ]

  let currentRows = [...rows]

  for (let turn = 0; turn < 10; turn++) {
    const reply = await callOllama(messages)
    messages.push(reply)

    if (!reply.tool_calls?.length) break

    let finished = false
    for (const toolCall of reply.tool_calls) {
      const { name, arguments: args } = toolCall.function

      if (name === 'finish') {
        finished = true
        break
      }

      await onStep?.(`transform: ${name}`)
      const before = currentRows.length

      if (name === 'dedupe') {
        currentRows = transform({ rows: currentRows, operation: 'dedupe' })
      } else if (name === 'drop_nulls') {
        currentRows = transform({ rows: currentRows, operation: 'drop_nulls' })
      } else if (name === 'rename_columns') {
        const mapping = (args as { mapping: Record<string, string> }).mapping
        currentRows = transform({ rows: currentRows, operation: 'rename_columns', options: mapping })
      }

      const removed = before - currentRows.length
      messages.push({
        role: 'tool',
        content: JSON.stringify({ success: true, rowsRemoved: removed, rowsRemaining: currentRows.length })
      })
    }

    if (finished) break
  }

  return currentRows
}
