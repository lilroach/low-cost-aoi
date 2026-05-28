import { useState, useEffect } from 'react'
import { History, ArrowRight, ArrowLeft, UploadCloud, CheckCircle, AlertTriangle, Target, Trash2, FileDown } from 'lucide-react'
import { cn } from '../../lib/utils'

export default function ReviewDashboard() {
    // --- STATE ---
    const [historyList, setHistoryList] = useState<any[]>([])
    const [selectedRun, setSelectedRun] = useState<any>(null)
    const [selectedRunDetail, setSelectedRunDetail] = useState<any>(null)
    const [viewResult, setViewResult] = useState<any>(null)

    // --- API CALLS ---
    const fetchHistory = async () => {
        try {
            const res = await fetch('/api/orchestrator/history')
            setHistoryList(await res.json())
        } catch (e) { console.error(e) }
    }

    const fetchRunDetail = async (runId: string) => {
        try {
            const res = await fetch(`/api/orchestrator/history/${runId}`)
            setSelectedRunDetail(await res.json())
        } catch (e) { console.error(e) }
    }

    const handleUpdateResult = async (runId: string, pointId: number, result: string) => {
        await fetch(`/api/orchestrator/history/${runId}/update_result?point_id=${pointId}&new_result=${result}`, { method: 'POST' })
        fetchRunDetail(runId) // Refresh detail
    }

    const handleUploadRun = async (runId: string) => {
        if (confirm("Upload this run result and images to Training Host?")) {
            const res = await fetch(`/api/orchestrator/history/${runId}/upload`, { method: 'POST' })
            const data = await res.json()
            alert(data.message)
        }
    }

    const handleDeleteRun = async (runId: string, e: React.MouseEvent) => {
        e.stopPropagation()
        if (confirm(`Are you sure you want to delete Run ${runId}? This cannot be undone.`)) {
            await fetch(`/api/orchestrator/history/${runId}`, { method: 'DELETE' })
            fetchHistory()
            if (selectedRun === runId) {
                setSelectedRun(null)
                setSelectedRunDetail(null)
            }
        }
    }

    const handleExportCsv = (runId: string) => {
        window.open(`/api/orchestrator/history/${runId}/export/csv`, '_blank')
    }

    // Initial Fetch
    useEffect(() => {
        fetchHistory()
    }, [])

    return (
        <div className="h-full flex flex-col gap-4 overflow-hidden">
            {!selectedRun ? (
                // LIST VIEW
                <div className="bg-zinc-900 rounded-2xl border border-zinc-800 flex-1 flex flex-col overflow-hidden">
                    <div className="p-4 border-b border-zinc-800 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 bg-zinc-950/40">
                        <div>
                            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">Inspection History</div>
                            <h3 className="font-bold text-white flex items-center gap-2 mt-1"><History size={20} /> History Review</h3>
                        </div>
                        <button onClick={fetchHistory} className="text-xs bg-zinc-800 px-3 py-2 rounded-lg border border-zinc-700 hover:bg-zinc-700 transition-colors">Refresh</button>
                    </div>
                    <div className="overflow-y-auto p-4 space-y-2">
                        {historyList.length === 0 && <div className="text-zinc-500 text-center py-10">No history found.</div>}
                        {historyList.map(run => (
                            <div key={run.run_id} onClick={() => { setSelectedRun(run.run_id); fetchRunDetail(run.run_id) }}
                                className="bg-zinc-950 p-4 rounded-xl border border-zinc-800 hover:border-blue-600/50 hover:bg-zinc-900 cursor-pointer transition flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 group">
                                <div className="min-w-0">
                                    <div className="font-bold text-white mb-1">{run.run_id}</div>
                                    <div className="text-xs text-zinc-500 flex flex-wrap gap-x-4 gap-y-1">
                                        <span>Part: {run.metadata?.part_no || "N/A"}</span>
                                        <span>Batch: {run.metadata?.batch_no || "N/A"}</span>
                                    </div>
                                </div>
                                <div className="flex items-center justify-between sm:justify-end gap-4">
                                    <div className="text-left sm:text-right">
                                        <div className={cn("text-sm font-bold", run.stats.ng > 0 ? "text-red-500" : "text-emerald-500")}>
                                            {run.stats.ng > 0 ? "NG Found" : "PASS"}
                                        </div>
                                        <div className="text-[10px] text-zinc-600">{run.stats.ng} NG / {run.stats.total} Total</div>
                                    </div>
                                    <button onClick={(e) => handleDeleteRun(run.run_id, e)} className="p-2 text-zinc-600 hover:text-red-500 hover:bg-zinc-800 rounded-lg transition" title="Delete Run">
                                        <Trash2 size={16} />
                                    </button>
                                    <ArrowRight size={16} className="text-zinc-600 group-hover:text-white" />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                // DETAIL VIEW
                <div className="flex-1 flex flex-col xl:flex-row gap-4 overflow-hidden">
                    {/* Left: List of Points */}
                    <div className="xl:w-1/3 bg-zinc-900 rounded-2xl border border-zinc-800 flex flex-col overflow-hidden min-h-[220px]">
                        <div className="p-4 border-b border-zinc-800 flex items-center gap-2 bg-zinc-950/40">
                            <button onClick={() => { setSelectedRun(null); setSelectedRunDetail(null) }} className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"><ArrowLeft size={16} /></button>
                            <h3 className="font-bold text-zinc-300 truncate min-w-0">Run {selectedRun}</h3>
                        </div>
                        <div className="flex-1 overflow-y-auto p-2 space-y-1">
                            {selectedRunDetail?.results.map((r: any) => (
                                <div key={r.point_id}
                                    onClick={() => setViewResult(r)}
                                    className={cn("p-2.5 rounded-lg border text-xs flex justify-between items-center cursor-pointer transition",
                                        viewResult?.point_id === r.point_id ? "bg-blue-600/20 border-blue-500" :
                                            r.result === 'NG' ? "bg-red-900/10 border-red-900/30 hover:bg-zinc-800" : "bg-zinc-950 border-zinc-800 hover:bg-zinc-800")}
                                >
                                    <div className="flex flex-col">
                                        <span className="font-bold text-zinc-400">Point #{r.point_id}</span>
                                        <span className="text-[10px] text-zinc-600">({r.x.toFixed(1)}, {r.y.toFixed(1)})</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {r.manual_override && <span className="text-[9px] bg-blue-900 text-blue-300 px-1 rounded">Edited</span>}
                                        <span className={cn("font-bold", r.result === 'NG' ? "text-red-500" : "text-emerald-500")}>{r.result}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="p-4 border-t border-zinc-800">
                            <div className="flex flex-col sm:flex-row gap-2">
                                <button onClick={() => handleExportCsv(selectedRun)} className="flex-1 py-3 bg-zinc-800 hover:bg-zinc-700 rounded-lg font-bold text-zinc-300 flex items-center justify-center gap-2 border border-zinc-700 transition-colors">
                                    <FileDown size={16} /> Export CSV
                                </button>
                                <button onClick={() => handleUploadRun(selectedRun)} className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 rounded-lg font-bold text-white flex items-center justify-center gap-2 shadow-lg shadow-blue-950/30 transition-colors">
                                    <UploadCloud size={16} /> Upload
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Right: Image & Review */}
                    <div className="flex-1 bg-zinc-900 rounded-2xl border border-zinc-800 flex flex-col p-4 overflow-hidden relative min-h-[420px]">
                        {viewResult ? (
                            <>
                                <div className="flex-1 bg-black rounded-xl flex items-center justify-center relative border border-zinc-800 overflow-hidden">
                                    <img
                                        src={`/data/history/${viewResult.image_path}`}
                                        className="max-w-full max-h-full object-contain"
                                        alt="Defect"
                                        onError={(e) => { e.currentTarget.src = 'https://placehold.co/600x400?text=No+Image'; }}
                                    />

                                    {/* Defect Overlay */}
                                    <div className="absolute top-2 left-2 bg-black/60 text-white px-2 py-1 text-xs rounded">
                                        Point #{viewResult.point_id}
                                    </div>
                                </div>

                                <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                    <div>
                                        <div className="text-zinc-400 text-xs">Current Judgment</div>
                                        <div className={cn("text-2xl font-bold", viewResult.result === 'NG' ? "text-red-500" : "text-emerald-500")}>
                                            {viewResult.result}
                                        </div>
                                    </div>

                                    <div className="flex w-full sm:w-auto flex-wrap gap-2">
                                        <button
                                            onClick={() => {
                                                handleUpdateResult(selectedRun, viewResult.point_id, 'OK')
                                                setViewResult({ ...viewResult, result: 'OK', manual_override: true })
                                            }}
                                            className={cn("flex-1 sm:flex-none px-6 py-3 rounded-lg font-bold flex items-center justify-center gap-2 transition",
                                                viewResult.result === 'OK' ? "bg-emerald-600/20 text-emerald-500 border border-emerald-600" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700")}
                                        >
                                            <CheckCircle size={20} /> Mark OK
                                        </button>

                                        <button
                                            onClick={() => {
                                                handleUpdateResult(selectedRun, viewResult.point_id, 'NG')
                                                setViewResult({ ...viewResult, result: 'NG', manual_override: true })
                                            }}
                                            className={cn("flex-1 sm:flex-none px-6 py-3 rounded-lg font-bold flex items-center justify-center gap-2 transition",
                                                viewResult.result === 'NG' ? "bg-red-600/20 text-red-500 border border-red-600" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700")}
                                        >
                                            <AlertTriangle size={20} /> Mark NG
                                        </button>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center text-zinc-600">
                                <Target size={48} className="mb-4 opacity-20" />
                                <p>Select a point from the list to review image.</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
