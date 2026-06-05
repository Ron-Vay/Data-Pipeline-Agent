import { useState, useEffect, useRef } from 'react';
import { Loader2, CheckCircle2, XCircle, ChevronRight } from 'lucide-react';
import { cn } from './lib/utils';

type Step = 'fetch_source' | 'inspect_schema' | 'transform' | 'store';

interface Progress {
  step: Step;
  status: string;
}

interface JobStatus {
  id: string;
  status: 'waiting' | 'active' | 'completed' | 'failed';
  progress: Progress | null;
  failedReason?: string;
}

const STEPS: { key: Step; label: string }[] = [
  { key: 'fetch_source', label: 'Fetch source' },
  { key: 'inspect_schema', label: 'Inspect schema' },
  { key: 'transform', label: 'Transform' },
  { key: 'store', label: 'Store' },
];

const STEP_ORDER: Step[] = ['fetch_source', 'inspect_schema', 'transform', 'store'];

function stepIndex(step: Step) {
  return STEP_ORDER.indexOf(step);
}

function useDots(active: boolean) {
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setFrame(f => (f + 1) % 3), 500);
    return () => clearInterval(id);
  }, [active]);
  return ['.', '..', '...'][frame];
}

function StepRow({ step, currentStep, currentStatus, jobStatus }: {
  step: { key: Step; label: string };
  currentStep: Step | null;
  currentStatus: string;
  jobStatus: string;
}) {
  const thisIdx = stepIndex(step.key);
  const currentIdx = currentStep !== null ? stepIndex(currentStep) : -1;

  const failed = thisIdx === currentIdx && currentStatus === 'failed';
  const done = jobStatus === 'completed' || (!failed && thisIdx < currentIdx);
  const current = !done && !failed && thisIdx === currentIdx;
  const waiting = !done && !current && !failed;

  const dots = useDots(current);

  return (
    <div className={cn(
      'flex items-center gap-3 px-4 py-3 rounded-lg border text-sm',
      done && 'border-green-200 bg-green-50 text-green-800',
      current && 'border-blue-200 bg-blue-50 text-blue-800',
      failed && 'border-red-200 bg-red-50 text-red-800',
      waiting && 'border-gray-200 bg-white text-gray-400',
    )}>
      <span className="flex-shrink-0 w-5 h-5">
        {done && <CheckCircle2 size={20} className="text-green-600" />}
        {failed && <XCircle size={20} className="text-red-600" />}
        {waiting && <ChevronRight size={20} className="text-gray-300" />}
      </span>
      <span className="font-medium">{step.label}</span>
      {current && <span className="flex-1 text-center font-mono text-blue-400">{dots}</span>}
      {current && <span className="text-xs opacity-70">{currentStatus}</span>}
    </div>
  );
}

function ProgressView({ jobId, onReset }: { jobId: string; onReset: () => void }) {
  const [job, setJob] = useState<JobStatus | null>(null);
  const [results, setResults] = useState<Record<string, string>[] | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    async function poll() {
      const res = await fetch(`/jobs/${jobId}`);
      if (!res.ok) return;
      const data: JobStatus = await res.json();
      setJob(data);

      if (data.status === 'completed') {
        clearInterval(intervalRef.current!);
        const rRes = await fetch(`/jobs/${jobId}/results`);
        if (rRes.ok) {
          const rData = await rRes.json();
          setResults(rData.results);
        }
      } else if (data.status === 'failed') {
        clearInterval(intervalRef.current!);
      }
    }

    poll();
    intervalRef.current = setInterval(poll, 2000);
    return () => clearInterval(intervalRef.current!);
  }, [jobId]);

  const currentStep = job?.progress?.step ?? null;
  const currentStatus = job?.progress?.status ?? '';
  const isDone = job?.status === 'completed' || job?.status === 'failed';

  function handleRunAnother() {
    if (!isDone) {
      setConfirmReset(true);
    } else {
      onReset();
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs text-gray-400 mb-1">Job ID</p>
        <code className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">{jobId}</code>
      </div>

      <div className="space-y-2">
        {STEPS.map((step) => (
          <StepRow
            key={step.key}
            step={step}
            currentStep={currentStep}
            currentStatus={currentStatus}
            jobStatus={job?.status ?? ''}
          />
        ))}
      </div>

      {job?.status === 'completed' && (
        <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          <CheckCircle2 size={16} className="text-green-600 flex-shrink-0" />
          <span>Pipeline complete{results ? ` — ${results.length} row${results.length !== 1 ? 's' : ''} stored` : ''}</span>
          {!results && <Loader2 size={14} className="animate-spin ml-auto text-green-600" />}
        </div>
      )}

      {results && <ResultsTable results={results} />}

      {job?.status === 'failed' && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <p className="font-medium">Job failed</p>
          {job.failedReason && <p className="mt-1 opacity-80">{job.failedReason}</p>}
        </div>
      )}

      {confirmReset ? (
        <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <span className="flex-1">Job still running — discard it and start over?</span>
          <button
            onClick={onReset}
            className="rounded px-3 py-1 bg-amber-600 text-white text-xs font-medium hover:bg-amber-700"
          >
            Discard
          </button>
          <button
            onClick={() => setConfirmReset(false)}
            className="rounded px-3 py-1 border border-amber-300 text-xs font-medium hover:bg-amber-100"
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          onClick={handleRunAnother}
          className="text-sm text-gray-400 hover:text-gray-600 underline"
        >
          Run another
        </button>
      )}
    </div>
  );
}

function ResultsTable({ results }: { results: Record<string, string>[] }) {
  if (results.length === 0) {
    return <p className="text-sm text-gray-500 text-center">No results after cleaning.</p>;
  }

  const columns = Object.keys(results[0]);

  return (
    <div>
      <h2 className="text-sm font-semibold text-gray-700 mb-2">
        Results — {results.length} row{results.length !== 1 ? 's' : ''}
      </h2>
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
            <tr>
              {columns.map((col) => (
                <th key={col} className="px-4 py-2 text-left font-medium whitespace-nowrap">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {results.map((row, i) => (
              <tr key={i} className="hover:bg-gray-50">
                {columns.map((col) => (
                  <td key={col} className="px-4 py-2 whitespace-nowrap text-gray-700">
                    {row[col] ?? ''}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function App() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [jobId, setJobId] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Something went wrong');
        return;
      }
      setJobId(data.jobId);
    } catch {
      setError('Could not reach server');
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    setJobId(null);
    setUrl('');
  }

  return (
    <div className="min-h-screen flex items-start justify-center pt-16 px-4">
      <div className="w-full max-w-xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Data Pipeline Agent</h1>
          <p className="text-sm text-gray-500 mt-1">
            Submit a CSV URL. The agent fetches, cleans, and stores the data automatically.
          </p>
        </div>

        {!jobId && (
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="flex gap-2">
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com/data.csv"
                required
                className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading && <Loader2 size={14} className="animate-spin" />}
                Run
              </button>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
          </form>
        )}

        {jobId && <ProgressView jobId={jobId} onReset={handleReset} />}
      </div>
    </div>
  );
}
