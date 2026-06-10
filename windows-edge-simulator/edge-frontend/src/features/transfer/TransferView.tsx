import { useEffect, useMemo, useState } from 'react'
import { CheckCircle, Database, Package, RefreshCw, Server, UploadCloud, XCircle } from 'lucide-react'
import { cn } from '../../lib/utils'

type ModelItem = {
    model_id: string
    part_no?: string
    version?: string
    format?: string
    runtime_compatible?: boolean
    status: 'valid' | 'invalid'
    error?: string
    path?: string
}

type ModelSnapshot = {
    model_root: string
    models: ModelItem[]
    active: Record<string, string>
    inference_enabled: boolean
}

const TRAINING_HOST_URL_KEY = 'aoi.trainingHostUrl'
const DEFAULT_TRAINING_HOST_URL = 'http://127.0.0.1:8000'

function filenameFromDisposition(disposition: string | null) {
    return disposition?.match(/filename="(.+)"/)?.[1] ?? `capture-bundle-${Date.now()}.zip`
}

async function parseJsonResponse(res: Response) {
    const text = await res.text()
    try {
        return text ? JSON.parse(text) : {}
    } catch {
        return { detail: text || res.statusText }
    }
}

export default function TransferView() {
    const [trainingHostUrl, setTrainingHostUrl] = useState(() => localStorage.getItem(TRAINING_HOST_URL_KEY) || DEFAULT_TRAINING_HOST_URL)
    const [bundleFile, setBundleFile] = useState<File | null>(null)
    const [modelFile, setModelFile] = useState<File | null>(null)
    const [modelSnapshot, setModelSnapshot] = useState<ModelSnapshot | null>(null)
    const [busy, setBusy] = useState<string | null>(null)
    const [message, setMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null)

    const importUrl = useMemo(() => `${trainingHostUrl.replace(/\/$/, '')}/api/datasets/import-run`, [trainingHostUrl])

    const fetchModels = async () => {
        const res = await fetch('/api/models')
        if (!res.ok) throw new Error('Model registry unavailable')
        setModelSnapshot(await res.json())
    }

    useEffect(() => {
        fetchModels().catch(() => undefined)
    }, [])

    const updateTrainingHostUrl = (value: string) => {
        setTrainingHostUrl(value)
        localStorage.setItem(TRAINING_HOST_URL_KEY, value)
    }

    const uploadBundleBlob = async (blob: Blob, filename: string) => {
        const form = new FormData()
        form.append('bundle', blob, filename)
        const res = await fetch(importUrl, { method: 'POST', body: form })
        const data = await parseJsonResponse(res)
        if (!res.ok) throw new Error(data.detail || 'Training Host import failed')
        return data
    }

    const sendReadyCaptures = async () => {
        setBusy('captures')
        setMessage(null)
        try {
            const bundleRes = await fetch('/api/capture/export/bundle')
            if (!bundleRes.ok) {
                const data = await parseJsonResponse(bundleRes)
                throw new Error(data.detail || 'Capture bundle is not ready')
            }
            const filename = filenameFromDisposition(bundleRes.headers.get('Content-Disposition'))
            const data = await uploadBundleBlob(await bundleRes.blob(), filename)
            setMessage({ type: 'ok', text: `Imported run ${data.run_id ?? filename}` })
        } catch (error) {
            setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Capture upload failed' })
        } finally {
            setBusy(null)
        }
    }

    const uploadSelectedBundle = async () => {
        if (!bundleFile) return
        setBusy('bundle')
        setMessage(null)
        try {
            const data = await uploadBundleBlob(bundleFile, bundleFile.name)
            setMessage({ type: 'ok', text: `Imported run ${data.run_id ?? bundleFile.name}` })
            setBundleFile(null)
        } catch (error) {
            setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Bundle upload failed' })
        } finally {
            setBusy(null)
        }
    }

    const uploadModelBundle = async () => {
        if (!modelFile) return
        setBusy('model')
        setMessage(null)
        try {
            const form = new FormData()
            form.append('bundle', modelFile, modelFile.name)
            const res = await fetch('/api/models/install', { method: 'POST', body: form })
            const data = await parseJsonResponse(res)
            if (!res.ok) throw new Error(data.detail || 'Model install failed')
            setMessage({ type: 'ok', text: `Installed model ${data.model?.model_id ?? modelFile.name}` })
            setModelFile(null)
            await fetchModels()
        } catch (error) {
            setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Model upload failed' })
        } finally {
            setBusy(null)
        }
    }

    const refreshModels = async () => {
        setBusy('refresh')
        setMessage(null)
        try {
            const res = await fetch('/api/models/refresh', { method: 'POST' })
            if (!res.ok) {
                const data = await parseJsonResponse(res)
                throw new Error(data.detail || 'Refresh failed')
            }
            setModelSnapshot(await res.json())
            setMessage({ type: 'ok', text: 'Model registry refreshed' })
        } catch (error) {
            setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Refresh failed' })
        } finally {
            setBusy(null)
        }
    }

    const activateModel = async (modelId: string) => {
        setBusy(`activate-${modelId}`)
        setMessage(null)
        try {
            const res = await fetch(`/api/models/${encodeURIComponent(modelId)}/activate`, { method: 'POST' })
            const data = await parseJsonResponse(res)
            if (!res.ok) throw new Error(data.detail || 'Activate failed')
            setMessage({ type: 'ok', text: `Active model updated for ${data.part_no ?? modelId}` })
            await fetchModels()
        } catch (error) {
            setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Activate failed' })
        } finally {
            setBusy(null)
        }
    }

    return (
        <div className="flex h-full min-h-0 flex-col gap-5 overflow-y-auto">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h2 className="text-lg font-bold text-white">Transfer</h2>
                    <div className="mt-1 text-xs text-zinc-500">Datasets and model bundles</div>
                </div>
                {message && (
                    <div className={cn('inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-semibold',
                        message.type === 'ok'
                            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                            : 'border-red-500/30 bg-red-500/10 text-red-300'
                    )}>
                        {message.type === 'ok' ? <CheckCircle size={16} /> : <XCircle size={16} />}
                        {message.text}
                    </div>
                )}
            </div>

            <section className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600/15 text-blue-300">
                            <Database size={20} />
                        </div>
                        <div>
                            <h3 className="font-bold text-white">Training Host Import</h3>
                            <div className="mt-1 text-xs text-zinc-500">Capture bundle to local Training Host</div>
                        </div>
                    </div>
                    <button
                        onClick={sendReadyCaptures}
                        disabled={Boolean(busy)}
                        className="inline-flex min-h-10 items-center gap-2 rounded-md bg-blue-600 px-4 text-sm font-bold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {busy === 'captures' ? <RefreshCw size={16} className="animate-spin" /> : <UploadCloud size={16} />}
                        Send Ready Captures
                    </button>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]">
                    <label className="block">
                        <span className="mb-1 block text-[10px] font-bold uppercase text-zinc-500">Training Host URL</span>
                        <input
                            value={trainingHostUrl}
                            onChange={(event) => updateTrainingHostUrl(event.target.value)}
                            className="h-11 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-100 outline-none focus:border-blue-500"
                        />
                    </label>
                    <div className="flex items-end">
                        <a
                            href={`${trainingHostUrl.replace(/\/$/, '')}/api/health`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex h-11 items-center gap-2 rounded-md border border-zinc-700 bg-zinc-800 px-4 text-sm font-bold text-zinc-200 hover:bg-zinc-700"
                        >
                            <Server size={16} />
                            Health
                        </a>
                    </div>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]">
                    <input
                        type="file"
                        accept=".zip,application/zip"
                        onChange={(event) => setBundleFile(event.target.files?.[0] ?? null)}
                        className="block w-full rounded-md border border-zinc-700 bg-zinc-950 text-sm text-zinc-300 file:mr-4 file:border-0 file:bg-zinc-800 file:px-4 file:py-3 file:text-sm file:font-bold file:text-zinc-200"
                    />
                    <button
                        onClick={uploadSelectedBundle}
                        disabled={!bundleFile || Boolean(busy)}
                        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-zinc-700 bg-zinc-800 px-4 text-sm font-bold text-zinc-100 hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {busy === 'bundle' ? <RefreshCw size={16} className="animate-spin" /> : <UploadCloud size={16} />}
                        Upload Bundle
                    </button>
                </div>
            </section>

            <section className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-600/15 text-emerald-300">
                            <Package size={20} />
                        </div>
                        <div>
                            <h3 className="font-bold text-white">Edge Model Library</h3>
                            <div className="mt-1 text-xs text-zinc-500">{modelSnapshot?.model_root ?? 'Loading model path'}</div>
                        </div>
                    </div>
                    <button
                        onClick={refreshModels}
                        disabled={Boolean(busy)}
                        className="inline-flex min-h-10 items-center gap-2 rounded-md border border-zinc-700 bg-zinc-800 px-4 text-sm font-bold text-zinc-200 hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        <RefreshCw size={16} className={busy === 'refresh' ? 'animate-spin' : ''} />
                        Refresh
                    </button>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]">
                    <input
                        type="file"
                        accept=".zip,application/zip"
                        onChange={(event) => setModelFile(event.target.files?.[0] ?? null)}
                        className="block w-full rounded-md border border-zinc-700 bg-zinc-950 text-sm text-zinc-300 file:mr-4 file:border-0 file:bg-zinc-800 file:px-4 file:py-3 file:text-sm file:font-bold file:text-zinc-200"
                    />
                    <button
                        onClick={uploadModelBundle}
                        disabled={!modelFile || Boolean(busy)}
                        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-emerald-600 px-4 text-sm font-bold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {busy === 'model' ? <RefreshCw size={16} className="animate-spin" /> : <UploadCloud size={16} />}
                        Install Model
                    </button>
                </div>

                <div className="mt-4 overflow-hidden rounded-md border border-zinc-800">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-zinc-950 text-[10px] uppercase text-zinc-500">
                            <tr>
                                <th className="px-3 py-3">Model</th>
                                <th className="px-3 py-3">Part</th>
                                <th className="px-3 py-3">Version</th>
                                <th className="px-3 py-3">Format</th>
                                <th className="px-3 py-3">Status</th>
                                <th className="px-3 py-3 text-right">Active</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-800">
                            {!modelSnapshot?.models.length && (
                                <tr>
                                    <td className="px-3 py-6 text-center text-zinc-500" colSpan={6}>No model bundles installed.</td>
                                </tr>
                            )}
                            {modelSnapshot?.models.map((model) => {
                                const isActive = model.part_no ? modelSnapshot.active?.[model.part_no] === model.model_id : false
                                return (
                                    <tr key={model.model_id} className="bg-zinc-900/60">
                                        <td className="px-3 py-3 font-mono text-xs text-zinc-200">{model.model_id}</td>
                                        <td className="px-3 py-3 text-zinc-300">{model.part_no ?? '-'}</td>
                                        <td className="px-3 py-3 text-zinc-400">{model.version ?? '-'}</td>
                                        <td className="px-3 py-3 text-xs text-zinc-400">{model.format ?? '-'}</td>
                                        <td className="px-3 py-3">
                                            <span className={cn('rounded-md px-2 py-1 text-xs font-bold',
                                                model.status === 'valid' ? 'bg-emerald-500/10 text-emerald-300' : 'bg-red-500/10 text-red-300'
                                            )}>
                                                {model.status}
                                            </span>
                                        </td>
                                        <td className="px-3 py-3 text-right">
                                            {model.status === 'valid' ? (
                                                <button
                                                    onClick={() => activateModel(model.model_id)}
                                                    disabled={isActive || Boolean(busy)}
                                                    className={cn('rounded-md px-3 py-2 text-xs font-bold',
                                                        isActive
                                                            ? 'bg-blue-500/10 text-blue-300'
                                                            : 'border border-zinc-700 bg-zinc-800 text-zinc-200 hover:bg-zinc-700'
                                                    )}
                                                >
                                                    {busy === `activate-${model.model_id}` ? 'Updating' : isActive ? 'Active' : 'Set Active'}
                                                </button>
                                            ) : (
                                                <span className="text-xs text-zinc-600">{model.error ?? 'Invalid'}</span>
                                            )}
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            </section>
        </div>
    )
}
