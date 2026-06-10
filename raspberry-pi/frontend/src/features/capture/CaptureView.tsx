import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Camera, CheckCircle, ChevronLeft, ChevronRight, Download, Eye, Hash, Maximize2, Package, Trash2, X, XCircle } from 'lucide-react'
import { cn } from '../../lib/utils'
import { useApp } from '../../context/AppContext'

type CaptureModel = {
    id: string
    name: string
    version: string
    enabled: boolean
}

type Detection = {
    label: string
    confidence: number
    box: number[]
}

type CaptureRecord = {
    id: string
    filename: string
    url: string
    captured_at: string | null
    part_no: string | null
    batch_no: string | null
    model_id: string
    model_name: string | null
    model_version: string | null
    model_result: 'OK' | 'NG' | null
    detections: Detection[]
    manual_result: 'OK' | 'NG' | null
    recognition_error: boolean
    export_ready: boolean
}

type ExportProject = {
    project: string
    date: string
    total: number
    ready_for_training: number
    recognition_errors: number
    bundle_format: string
    bundle_contents: string[]
    transfer: string
    captures: CaptureRecord[]
}

const RESULT_STYLES = {
    OK: 'border-emerald-700 bg-emerald-950/40 text-emerald-300',
    NG: 'border-red-700 bg-red-950/40 text-red-300',
}

export default function CaptureView() {
    const { partNo, setPartNo, batchNo, setBatchNo } = useApp()
    const [isSnapping, setIsSnapping] = useState(false)
    const [showSuccess, setShowSuccess] = useState(false)
    const [captures, setCaptures] = useState<CaptureRecord[]>([])
    const [models, setModels] = useState<CaptureModel[]>([])
    const [selectedModelId, setSelectedModelId] = useState('none')
    const [selectedCapture, setSelectedCapture] = useState<CaptureRecord | null>(null)
    const [showListModal, setShowListModal] = useState(false)
    const [showExport, setShowExport] = useState(false)
    const [exportProjectData, setExportProjectData] = useState<ExportProject | null>(null)
    const [editPartNo, setEditPartNo] = useState('')
    const [editBatchNo, setEditBatchNo] = useState('')
    const [isUpdatingMetadata, setIsUpdatingMetadata] = useState(false)

    const selectedModel = useMemo(
        () => models.find((model) => model.id === selectedModelId),
        [models, selectedModelId],
    )
    const selectedCaptureIndex = useMemo(
        () => selectedCapture ? captures.findIndex((capture) => capture.id === selectedCapture.id) : -1,
        [captures, selectedCapture],
    )
    const cameraImageSrc = '/api/camera/feed'

    const fetchModels = async () => {
        const res = await fetch('/api/capture/models')
        const data = await res.json()
        setModels(data.models ?? [])
    }

    const fetchCaptures = async () => {
        const res = await fetch('/api/capture/list')
        const data = await res.json()
        setCaptures(data.images ?? [])
    }

    useEffect(() => {
        fetchModels().catch(() => setModels([{ id: 'none', name: 'No model', version: '-', enabled: false }]))
        fetchCaptures().catch(() => setCaptures([]))
    }, [])

    useEffect(() => {
        setEditPartNo(selectedCapture?.part_no ?? '')
        setEditBatchNo(selectedCapture?.batch_no ?? '')
    }, [selectedCapture])

    const handleSnap = async () => {
        if (isSnapping) return
        setIsSnapping(true)
        try {
            const params = new URLSearchParams({
                part_no: partNo || 'NA',
                batch_no: batchNo || 'NA',
                model_id: selectedModelId,
            })
            const res = await fetch(`/api/capture/snap?${params.toString()}`, { method: 'POST' })
            if (!res.ok) {
                const data = await res.json().catch(() => ({ detail: 'Capture failed' }))
                throw new Error(data.detail ?? 'Capture failed')
            }
            await fetchCaptures().catch(() => undefined)
            setShowSuccess(true)
            setTimeout(() => setShowSuccess(false), 1200)
        } catch (error) {
            alert(error instanceof Error ? error.message : 'Capture failed')
        } finally {
            setIsSnapping(false)
        }
    }

    const updateManualResult = async (captureId: string, result: 'OK' | 'NG') => {
        const res = await fetch(`/api/capture/${captureId}/manual_result?result=${result}`, { method: 'POST' })
        if (!res.ok) {
            alert('Failed to update manual judgement')
            return
        }
        const data = await res.json()
        setCaptures((items) => items.map((item) => item.id === captureId ? data.capture : item))
        setSelectedCapture((current) => current?.id === captureId ? data.capture : current)
    }

    const updateCaptureMetadata = async (captureId: string, payload: { part_no?: string; batch_no?: string; model_id?: string }) => {
        setIsUpdatingMetadata(true)
        try {
            const res = await fetch(`/api/capture/${captureId}/metadata`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            })
            if (!res.ok) throw new Error('Failed to update capture metadata')
            const data = await res.json()
            setCaptures((items) => items.map((item) => item.id === captureId ? data.capture : item))
            setSelectedCapture((current) => current?.id === captureId ? data.capture : current)
        } catch (e) {
            alert('Failed to update capture metadata')
        } finally {
            setIsUpdatingMetadata(false)
        }
    }

    const savePartBatch = () => {
        if (!selectedCapture) return
        const nextPartNo = editPartNo.trim() || 'NA'
        const nextBatchNo = editBatchNo.trim() || 'NA'
        if (nextPartNo === (selectedCapture.part_no ?? '') && nextBatchNo === (selectedCapture.batch_no ?? '')) return
        updateCaptureMetadata(selectedCapture.id, { part_no: nextPartNo, batch_no: nextBatchNo })
    }

    const navigateSelectedCapture = (offset: number) => {
        if (selectedCaptureIndex < 0) return
        const nextCapture = captures[selectedCaptureIndex + offset]
        if (nextCapture) setSelectedCapture(nextCapture)
    }

    const openExportPanel = async () => {
        const res = await fetch('/api/capture/export')
        if (!res.ok) {
            alert('Failed to prepare export')
            return
        }
        setExportProjectData(await res.json())
        setShowExport(true)
    }

    const downloadBlob = (blob: Blob, filename: string) => {
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = filename
        link.click()
        URL.revokeObjectURL(url)
    }

    const downloadExportJson = () => {
        if (!exportProjectData) return
        const blob = new Blob([JSON.stringify(exportProjectData, null, 2)], { type: 'application/json' })
        downloadBlob(blob, `capture-project-${exportProjectData.date}.json`)
    }

    const downloadUsbBundle = async () => {
        const res = await fetch('/api/capture/export/bundle')
        if (!res.ok) {
            const data = await res.json().catch(() => ({ detail: 'Failed to export bundle' }))
            alert(data.detail ?? 'Failed to export bundle')
            return
        }
        const disposition = res.headers.get('Content-Disposition') ?? ''
        const filename = disposition.match(/filename="(.+)"/)?.[1] ?? `capture-bundle-${exportProjectData?.date ?? 'today'}.zip`
        downloadBlob(await res.blob(), filename)
    }

    const clearCaptureList = async () => {
        const shouldClear = window.confirm('Clear the Capture Result List? Existing image files will stay on disk.')
        if (!shouldClear) return
        const res = await fetch('/api/capture/list', { method: 'DELETE' })
        if (!res.ok) {
            alert('Failed to clear list')
            return
        }
        setCaptures([])
        setSelectedCapture(null)
        setShowListModal(false)
    }

    const renderResultBadge = (result: 'OK' | 'NG' | null) => {
        if (!result) return <span className="rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1 text-xs text-zinc-500">None</span>
        return (
            <span className={cn('inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-bold', RESULT_STYLES[result])}>
                {result === 'OK' ? <CheckCircle size={14} /> : <AlertTriangle size={14} />}
                {result}
            </span>
        )
    }

    const formatConfidence = (confidence: number) => `${(confidence * 100).toFixed(1)}%`

    const topDetection = (capture: CaptureRecord) => (
        [...(capture.detections ?? [])].sort((a, b) => b.confidence - a.confidence)[0] ?? null
    )

    const renderConfidenceBadge = (capture: CaptureRecord) => {
        const detection = topDetection(capture)
        if (!detection) return <span className="rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1 text-xs text-zinc-500">No match</span>
        return (
            <span className="inline-flex items-center gap-1 rounded-md border border-blue-700 bg-blue-950/40 px-2 py-1 text-xs font-bold text-blue-300">
                {detection.label}
                <span className="font-mono text-blue-200">{formatConfidence(detection.confidence)}</span>
            </span>
        )
    }

    const renderCompactList = (isModal = false) => (
        <div className={cn('min-h-0 flex-1 overflow-x-auto overflow-y-auto', isModal ? 'h-full' : 'max-h-[calc(100vh-360px)]')}>
            <table className="w-full min-w-[360px] text-left text-sm">
                <thead className="sticky top-0 z-10 bg-zinc-950 text-[10px] uppercase text-zinc-500">
                    <tr>
                        <th className="px-3 py-3">Image</th>
                        {isModal && <th className="px-3 py-3">Time</th>}
                        <th className="px-3 py-3">Model</th>
                        <th className="px-3 py-3">YOLO OK/NG</th>
                        <th className="px-3 py-3">Top Match</th>
                        {isModal && <th className="px-3 py-3">Manual OK/NG</th>}
                        {isModal && <th className="px-3 py-3">Export</th>}
                    </tr>
                </thead>
                <tbody>
                    {captures.length === 0 ? (
                        <tr>
                            <td colSpan={isModal ? 7 : 4} className="px-3 py-12 text-center text-zinc-500">No capture records yet.</td>
                        </tr>
                    ) : captures.map((capture) => (
                        <tr key={capture.id} className="border-t border-zinc-800/80 hover:bg-zinc-800/40">
                            <td className="px-3 py-3">
                                <button onClick={() => setSelectedCapture(capture)} className={cn('flex items-center gap-2 text-zinc-200 hover:text-blue-300', isModal ? 'max-w-[360px]' : 'max-w-[150px]')}>
                                    <Eye size={15} />
                                    <span className="truncate font-mono text-xs">{capture.filename}</span>
                                </button>
                            </td>
                            {isModal && <td className="px-3 py-3 text-xs text-zinc-400">{capture.captured_at ?? '-'}</td>}
                            <td className="px-3 py-3 text-xs text-zinc-300">{capture.model_name ?? 'No model'}</td>
                            <td className="px-3 py-3">{renderResultBadge(capture.model_result)}</td>
                            <td className="px-3 py-3">{renderConfidenceBadge(capture)}</td>
                            {isModal && (
                                <td className="px-3 py-3">
                                    <div className="flex items-center gap-2">
                                        <button onClick={() => updateManualResult(capture.id, 'OK')} className={cn('inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-bold', capture.manual_result === 'OK' ? RESULT_STYLES.OK : 'border-zinc-700 bg-zinc-800 text-zinc-400 hover:bg-zinc-700')}>
                                            <CheckCircle size={14} /> OK
                                        </button>
                                        <button onClick={() => updateManualResult(capture.id, 'NG')} className={cn('inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-bold', capture.manual_result === 'NG' ? RESULT_STYLES.NG : 'border-zinc-700 bg-zinc-800 text-zinc-400 hover:bg-zinc-700')}>
                                            <XCircle size={14} /> NG
                                        </button>
                                    </div>
                                    {capture.recognition_error && <div className="mt-2 text-[10px] font-bold uppercase text-amber-300">Recognition error</div>}
                                </td>
                            )}
                            {isModal && (
                                <td className="px-3 py-3">
                                    <span className={cn('rounded-md px-2 py-1 text-xs font-bold', capture.export_ready ? 'bg-emerald-500/10 text-emerald-300' : 'bg-zinc-950 text-zinc-500')}>
                                        {capture.export_ready ? 'Ready' : 'Pending'}
                                    </span>
                                </td>
                            )}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )

    return (
        <div className="flex h-[calc(100vh-112px)] max-h-[calc(100vh-112px)] flex-col gap-4 overflow-hidden">
            <div className="grid gap-3 rounded-xl border border-zinc-800 bg-zinc-900/70 p-4 shadow-xl shadow-black/10 lg:grid-cols-[1fr_1fr_1fr_auto]">
                <div className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2.5 focus-within:border-blue-500/60">
                    <Package size={16} className="text-zinc-500" />
                    <div className="flex min-w-0 flex-1 flex-col">
                        <label className="text-[10px] font-bold uppercase text-zinc-500">Part Number</label>
                        <input value={partNo} onChange={(e) => setPartNo(e.target.value)} placeholder="PCB-A-V1" className="w-full bg-transparent text-sm text-zinc-200 outline-none placeholder:text-zinc-700" />
                    </div>
                </div>
                <div className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2.5 focus-within:border-blue-500/60">
                    <Hash size={16} className="text-zinc-500" />
                    <div className="flex min-w-0 flex-1 flex-col">
                        <label className="text-[10px] font-bold uppercase text-zinc-500">Batch Number</label>
                        <input value={batchNo} onChange={(e) => setBatchNo(e.target.value)} placeholder="LOT-001" className="w-full bg-transparent text-sm text-zinc-200 outline-none placeholder:text-zinc-700" />
                    </div>
                </div>
                <div className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2.5">
                    <Camera size={16} className="text-zinc-500" />
                    <div className="flex min-w-0 flex-1 flex-col">
                        <label className="text-[10px] font-bold uppercase text-zinc-500">Model</label>
                        <select value={selectedModelId} onChange={(e) => setSelectedModelId(e.target.value)} className="w-full bg-transparent text-sm text-zinc-200 outline-none">
                            {models.map((model) => (
                                <option key={model.id} value={model.id} className="bg-zinc-950 text-zinc-200">
                                    {model.enabled ? `${model.name} ${model.version}` : 'No model'}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
                <button onClick={openExportPanel} className="inline-flex min-h-[58px] items-center justify-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800 px-4 text-sm font-bold text-zinc-200 hover:bg-zinc-700">
                    <Download size={18} />
                    Export
                </button>
            </div>

            <div className="grid min-h-0 flex-1 gap-4 overflow-hidden lg:grid-cols-[minmax(0,2fr)_minmax(360px,1fr)]">
                <div className="relative flex min-h-[420px] items-center justify-center overflow-hidden rounded-2xl border border-zinc-800 bg-black shadow-2xl shadow-black/40 lg:min-h-0">
                    <img
                        src={cameraImageSrc}
                        className="absolute inset-0 h-full w-full object-contain"
                        alt="Camera live feed"
                    />
                    {isSnapping && <div className="absolute inset-0 z-40 bg-white/20" />}
                    {showSuccess && (
                        <div className="absolute left-1/2 top-1/2 z-50 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-2 rounded-2xl bg-emerald-500/90 px-6 py-4 text-white shadow-2xl">
                            <CheckCircle size={34} strokeWidth={3} />
                            <span className="text-sm font-bold uppercase">Saved to list</span>
                        </div>
                    )}
                    <div className="absolute left-4 top-4 rounded-lg border border-white/10 bg-black/75 px-3 py-2 text-xs text-zinc-300 backdrop-blur">
                        <div className="font-bold text-white">Capture Mode</div>
                        <div>{selectedModel?.enabled ? 'Model path enabled' : 'No model path'}</div>
                    </div>
                    <div className="absolute right-4 top-4 z-30 flex max-w-[calc(100%-2rem)] items-center gap-2 rounded-lg border border-white/10 bg-black/75 px-3 py-2 text-xs text-zinc-300 backdrop-blur">
                        <span className="font-bold text-white">Live Feed</span>
                    </div>
                    <button
                        onClick={handleSnap}
                        disabled={isSnapping}
                        className={cn(
                            'absolute bottom-6 right-6 z-50 flex h-24 w-24 flex-col items-center justify-center rounded-full text-white shadow-2xl transition active:scale-95',
                            isSnapping ? 'bg-zinc-700 opacity-60' : 'bg-blue-600 hover:bg-blue-500',
                        )}
                    >
                        {isSnapping ? <div className="h-8 w-8 animate-spin rounded-full border-4 border-white/30 border-t-white" /> : <Camera size={34} />}
                        <span className="mt-1 text-[10px] font-black uppercase tracking-widest">SNAP</span>
                    </button>
                </div>

                <div className="flex h-full min-h-0 max-h-full flex-col overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 bg-zinc-950/50 p-4">
                        <div>
                            <h2 className="text-lg font-bold text-white">Capture Result List</h2>
                            <p className="text-xs text-zinc-500">Snap to list to model path to manual OK/NG to export</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setShowListModal(true)}
                                disabled={captures.length === 0}
                                className="inline-flex items-center justify-center rounded-lg border border-zinc-700 bg-zinc-800 p-2 text-zinc-300 hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40"
                                title="Expand list"
                            >
                                <Maximize2 size={14} />
                            </button>
                            <button
                                onClick={clearCaptureList}
                                disabled={captures.length === 0}
                                className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs font-bold text-zinc-300 hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                <Trash2 size={14} />
                                Clear List
                            </button>
                            <span className="rounded-full bg-blue-500/10 px-3 py-1 text-xs font-bold text-blue-300">{captures.length} items</span>
                        </div>
                    </div>
                    {renderCompactList()}
                </div>
            </div>

            {showListModal && (
                <div className="fixed inset-0 z-[105] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
                    <div className="flex h-[86vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 shadow-2xl">
                        <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-950/60 p-5">
                            <div>
                                <h2 className="text-xl font-bold text-white">Capture Result List</h2>
                                <p className="text-sm text-zinc-500">Open an image row to review and set manual OK/NG.</p>
                            </div>
                            <button onClick={() => setShowListModal(false)} className="rounded-full p-2 text-zinc-500 hover:bg-zinc-800 hover:text-white">
                                <X size={24} />
                            </button>
                        </div>
                        <div className="min-h-0 flex-1 overflow-hidden">
                            {renderCompactList(true)}
                        </div>
                    </div>
                </div>
            )}

            {selectedCapture && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm">
                    <div className="grid h-[86vh] w-full max-w-6xl overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 shadow-2xl lg:grid-cols-[1fr_380px]">
                        <div className="flex min-h-[360px] items-center justify-center bg-black p-4">
                            <img src={selectedCapture.url} className="max-h-[82vh] max-w-full rounded-lg object-contain" alt="Capture preview" />
                        </div>
                        <div className="flex min-h-0 flex-col border-l border-zinc-800">
                            <div className="flex items-start justify-between gap-3 border-b border-zinc-800 bg-zinc-950/60 p-5">
                                <div className="min-w-0">
                                    <h2 className="truncate text-lg font-bold text-white">{selectedCapture.filename}</h2>
                                    <p className="mt-1 text-xs text-zinc-500">{selectedCapture.captured_at ?? '-'}</p>
                                </div>
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={() => navigateSelectedCapture(-1)}
                                        disabled={selectedCaptureIndex <= 0}
                                        className="rounded-full p-2 text-zinc-500 hover:bg-zinc-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
                                        title="Previous"
                                    >
                                        <ChevronLeft size={22} />
                                    </button>
                                    <button
                                        onClick={() => navigateSelectedCapture(1)}
                                        disabled={selectedCaptureIndex < 0 || selectedCaptureIndex >= captures.length - 1}
                                        className="rounded-full p-2 text-zinc-500 hover:bg-zinc-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
                                        title="Next"
                                    >
                                        <ChevronRight size={22} />
                                    </button>
                                    <button onClick={() => setSelectedCapture(null)} className="rounded-full p-2 text-zinc-500 hover:bg-zinc-800 hover:text-white">
                                        <X size={22} />
                                    </button>
                                </div>
                            </div>
                            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3">
                                        <div className="text-[10px] font-bold uppercase text-zinc-500">Part</div>
                                        <input
                                            value={editPartNo}
                                            onChange={(e) => setEditPartNo(e.target.value)}
                                            onBlur={savePartBatch}
                                            onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
                                            className="mt-1 w-full bg-transparent text-sm text-zinc-200 outline-none"
                                        />
                                    </div>
                                    <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3">
                                        <div className="text-[10px] font-bold uppercase text-zinc-500">Batch</div>
                                        <input
                                            value={editBatchNo}
                                            onChange={(e) => setEditBatchNo(e.target.value)}
                                            onBlur={savePartBatch}
                                            onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
                                            className="mt-1 w-full bg-transparent text-sm text-zinc-200 outline-none"
                                        />
                                    </div>
                                </div>
                                <div className="min-h-[138px] rounded-lg border border-zinc-800 bg-zinc-950 p-4">
                                    <div className="text-[10px] font-bold uppercase text-zinc-500">Model</div>
                                    <select
                                        value={selectedCapture.model_id}
                                        onChange={(e) => updateCaptureMetadata(selectedCapture.id, { model_id: e.target.value })}
                                        disabled={isUpdatingMetadata}
                                        className="mt-1 w-full bg-transparent text-sm text-zinc-200 outline-none disabled:opacity-50"
                                    >
                                        {models.map((model) => (
                                            <option key={model.id} value={model.id} className="bg-zinc-950 text-zinc-200">
                                                {model.enabled ? `${model.name} ${model.version}` : 'No model'}
                                            </option>
                                        ))}
                                    </select>
                                    <div className="mt-3 flex items-center justify-between">
                                        <span className="text-xs text-zinc-500">YOLO OK/NG</span>
                                        {renderResultBadge(selectedCapture.model_result)}
                                    </div>
                                    <div className="mt-3 flex items-center justify-between gap-3">
                                        <span className="text-xs text-zinc-500">Top Match</span>
                                        {renderConfidenceBadge(selectedCapture)}
                                    </div>
                                </div>
                                <div className="min-h-[128px] rounded-lg border border-zinc-800 bg-zinc-950 p-4">
                                    <div className="mb-3 flex items-center justify-between">
                                        <span className="text-[10px] font-bold uppercase text-zinc-500">Detections</span>
                                        <span className="rounded-md bg-zinc-900 px-2 py-1 text-xs font-bold text-zinc-400">{selectedCapture.detections?.length ?? 0}</span>
                                    </div>
                                    {!selectedCapture.detections?.length ? (
                                        <div className="rounded-lg border border-dashed border-zinc-800 bg-zinc-900/50 p-3 text-xs text-zinc-500">
                                            No object matched above the model confidence threshold.
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            {selectedCapture.detections.map((detection, index) => (
                                                <div key={`${detection.label}-${index}`} className="rounded-lg border border-zinc-800 bg-zinc-900 p-3">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <span className="truncate text-sm font-bold text-zinc-100">{detection.label}</span>
                                                        <span className="font-mono text-sm font-bold text-blue-300">{formatConfidence(detection.confidence)}</span>
                                                    </div>
                                                    <div className="mt-2 font-mono text-[10px] text-zinc-500">
                                                        box [{detection.box.join(', ')}]
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <div className="min-h-[178px] rounded-lg border border-zinc-800 bg-zinc-950 p-4">
                                    <div className="mb-3 flex items-center justify-between">
                                        <span className="text-[10px] font-bold uppercase text-zinc-500">Manual OK/NG</span>
                                        {renderResultBadge(selectedCapture.manual_result)}
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <button onClick={() => updateManualResult(selectedCapture.id, 'OK')} className={cn('inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-3 text-sm font-bold', selectedCapture.manual_result === 'OK' ? RESULT_STYLES.OK : 'border-zinc-700 bg-zinc-800 text-zinc-400 hover:bg-zinc-700')}>
                                            <CheckCircle size={16} /> OK
                                        </button>
                                        <button onClick={() => updateManualResult(selectedCapture.id, 'NG')} className={cn('inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-3 text-sm font-bold', selectedCapture.manual_result === 'NG' ? RESULT_STYLES.NG : 'border-zinc-700 bg-zinc-800 text-zinc-400 hover:bg-zinc-700')}>
                                            <XCircle size={16} /> NG
                                        </button>
                                    </div>
                                    <div className={cn('mt-3 min-h-4 text-[10px] font-bold uppercase', selectedCapture.recognition_error ? 'text-amber-300' : 'text-transparent')}>
                                        Recognition error
                                    </div>
                                </div>
                                <div className="min-h-[96px] rounded-lg border border-zinc-800 bg-zinc-950 p-4">
                                    <div className="text-[10px] font-bold uppercase text-zinc-500">Export</div>
                                    <div className={cn('mt-2 inline-flex rounded-md px-2 py-1 text-xs font-bold', selectedCapture.export_ready ? 'bg-emerald-500/10 text-emerald-300' : 'bg-zinc-900 text-zinc-500')}>
                                        {selectedCapture.export_ready ? 'Ready' : 'Pending'}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showExport && exportProjectData && (
                <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
                    <div className="flex max-h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 shadow-2xl">
                        <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-950/60 p-5">
                            <div>
                                <h2 className="text-xl font-bold text-white">Export Capture Project</h2>
                                <p className="text-sm text-zinc-500">Review today's capture dataset before downloading the USB transfer bundle.</p>
                            </div>
                            <button onClick={() => setShowExport(false)} className="rounded-full p-2 text-zinc-500 hover:bg-zinc-800 hover:text-white">
                                <X size={24} />
                            </button>
                        </div>

                        <div className="grid gap-3 border-b border-zinc-800 p-5 sm:grid-cols-4">
                            <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
                                <div className="text-[10px] font-bold uppercase text-zinc-500">Total</div>
                                <div className="mt-1 text-2xl font-bold text-white">{exportProjectData.total}</div>
                            </div>
                            <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
                                <div className="text-[10px] font-bold uppercase text-zinc-500">Ready</div>
                                <div className="mt-1 text-2xl font-bold text-emerald-300">{exportProjectData.ready_for_training}</div>
                            </div>
                            <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
                                <div className="text-[10px] font-bold uppercase text-zinc-500">Recognition Errors</div>
                                <div className="mt-1 text-2xl font-bold text-amber-300">{exportProjectData.recognition_errors}</div>
                            </div>
                            <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
                                <div className="text-[10px] font-bold uppercase text-zinc-500">Date</div>
                                <div className="mt-1 text-lg font-bold text-blue-300">{exportProjectData.date}</div>
                            </div>
                        </div>

                        <div className="border-b border-zinc-800 px-5 py-4">
                            <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400">
                                <span className="rounded-md bg-blue-500/10 px-2 py-1 font-bold uppercase text-blue-300">USB Transfer</span>
                                <span>{exportProjectData.bundle_format}</span>
                                <span className="text-zinc-700">/</span>
                                <span>{exportProjectData.bundle_contents.join(', ')}</span>
                            </div>
                        </div>

                        <div className="min-h-0 flex-1 overflow-auto p-5">
                            {exportProjectData.captures.length === 0 ? (
                                <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-8 text-center text-zinc-500">No capture records to export.</div>
                            ) : (
                                <div className="overflow-hidden rounded-lg border border-zinc-800">
                                    <table className="w-full min-w-[720px] text-left text-sm">
                                        <thead className="bg-zinc-950 text-[10px] uppercase text-zinc-500">
                                            <tr>
                                                <th className="px-3 py-3">Image</th>
                                                <th className="px-3 py-3">Model</th>
                                                <th className="px-3 py-3">YOLO</th>
                                                <th className="px-3 py-3">Top Match</th>
                                                <th className="px-3 py-3">Manual</th>
                                                <th className="px-3 py-3">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {exportProjectData.captures.map((capture) => (
                                                <tr key={capture.id} className="border-t border-zinc-800">
                                                    <td className="px-3 py-3 font-mono text-xs text-zinc-200">{capture.filename}</td>
                                                    <td className="px-3 py-3 text-zinc-300">{capture.model_name ?? 'No model'}</td>
                                                    <td className="px-3 py-3">{renderResultBadge(capture.model_result)}</td>
                                                    <td className="px-3 py-3">{renderConfidenceBadge(capture)}</td>
                                                    <td className="px-3 py-3">{renderResultBadge(capture.manual_result)}</td>
                                                    <td className="px-3 py-3">
                                                        <span className={cn('rounded-md px-2 py-1 text-xs font-bold', capture.export_ready ? 'bg-emerald-500/10 text-emerald-300' : 'bg-zinc-950 text-zinc-500')}>
                                                            {capture.export_ready ? 'Ready' : 'Pending'}
                                                        </span>
                                                        {capture.recognition_error && <span className="ml-2 rounded-md bg-amber-500/10 px-2 py-1 text-xs font-bold text-amber-300">Review</span>}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>

                        <div className="flex flex-wrap justify-end gap-3 border-t border-zinc-800 bg-zinc-950/60 p-5">
                            <button onClick={() => setShowExport(false)} className="rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm font-bold text-zinc-300 hover:bg-zinc-700">
                                Close
                            </button>
                            <button onClick={downloadExportJson} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-500">
                                <Download size={16} />
                                Download JSON Preview
                            </button>
                            <button
                                onClick={downloadUsbBundle}
                                disabled={exportProjectData.ready_for_training === 0}
                                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                <Download size={16} />
                                Download USB Bundle
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
