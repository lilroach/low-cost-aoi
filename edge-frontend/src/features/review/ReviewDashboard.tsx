import { useState, useEffect } from 'react'
import { History, ArrowRight, ArrowLeft, UploadCloud, CheckCircle, AlertTriangle, Target } from 'lucide-react'
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

    // Initial Fetch
    useEffect(() => {
        fetchHistory()
    }, [])

    return (
        <div className="h-full flex flex-col gap-4 overflow-hidden">
            {!selectedRun ? (
                // LIST VIEW
                <div className="bg-zinc-900 rounded-xl border border-zinc-800 flex-1 flex flex-col overflow-hidden">
                    <div className="p-4 border-b border-zinc-800 flex justify-between items-center">
                        <h3 className="font-bold text-white flex items-center gap-2"><History size={20} /> History Review</h3>
                        <button onClick={fetchHistory} className="text-xs bg-zinc-800 px-3 py-1 rounded hover:bg-zinc-700">Refresh</button>
                    </div>
                    <div className="overflow-y-auto p-4 space-y-2">
                        {historyList.length === 0 && <div className="text-zinc-500 text-center py-10">No history found.</div>}
                        {historyList.map(run => (
                            <div key={run.run_id} onClick={() => { setSelectedRun(run.run_id); fetchRunDetail(run.run_id) }}
                                className="bg-zinc-950 p-4 rounded-lg border border-zinc-800 hover:border-zinc-600 cursor-pointer transition flex justify-between items-center group">
                                <div>
                                    <div className="font-bold text-white mb-1">{run.run_id}</div>
                                    <div className="text-xs text-zinc-500 flex gap-4">
                                        <span>Part: {run.metadata?.part_no || "N/A"}</span>
                                        <span>Batch: {run.metadata?.batch_no || "N/A"}</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="text-right">
                                        <div className={cn("text-sm font-bold", run.stats.ng > 0 ? "text-red-500" : "text-emerald-500")}>
                                            {run.stats.ng > 0 ? "NG Found" : "PASS"}
                                        </div>
                                        <div className="text-[10px] text-zinc-600">{run.stats.ng} NG / {run.stats.total} Total</div>
                                    </div>
                                    <ArrowRight size={16} className="text-zinc-600 group-hover:text-white" />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                // DETAIL VIEW
                <div className="flex-1 flex gap-4 overflow-hidden">
                    {/* Left: List of Points */}
                    <div className="w-1/3 bg-zinc-900 rounded-xl border border-zinc-800 flex flex-col overflow-hidden">
                        <div className="p-4 border-b border-zinc-800 flex items-center gap-2">
                            <button onClick={() => { setSelectedRun(null); setSelectedRunDetail(null) }} className="p-1 hover:bg-zinc-800 rounded"><ArrowLeft size={16} /></button>
                            <h3 className="font-bold text-zinc-300 truncate">Run {selectedRun}</h3>
                        </div>
                        <div className="flex-1 overflow-y-auto p-2 space-y-1">
                            {selectedRunDetail?.results.map((r: any) => (
                                <div key={r.point_id}
                                    onClick={() => setViewResult(r)}
                                    className={cn("p-2 rounded border text-xs flex justify-between items-center cursor-pointer transition",
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
                            <button onClick={() => handleUploadRun(selectedRun)} className="w-full py-3 bg-blue-600 hover:bg-blue-500 rounded font-bold text-white flex justify-center gap-2">
                                <UploadCloud size={16} /> Upload to Host
                            </button>
                        </div>
                    </div>

                    {/* Right: Image & Review */}
                    <div className="flex-1 bg-zinc-900 rounded-xl border border-zinc-800 flex flex-col p-4 overflow-hidden relative">
                        {viewResult ? (
                            <>
                                <div className="flex-1 bg-black rounded-lg flex items-center justify-center relative border border-zinc-800 overflow-hidden">
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

                                <div className="mt-4 flex items-center justify-between">
                                    <div>
                                        <div className="text-zinc-400 text-xs">Current Judgment</div>
                                        <div className={cn("text-2xl font-bold", viewResult.result === 'NG' ? "text-red-500" : "text-emerald-500")}>
                                            {viewResult.result}
                                        </div>
                                    </div>

                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => {
                                                handleUpdateResult(selectedRun, viewResult.point_id, 'OK')
                                                setViewResult({ ...viewResult, result: 'OK', manual_override: true })
                                            }}
                                            className={cn("px-6 py-3 rounded-lg font-bold flex items-center gap-2 transition",
                                                viewResult.result === 'OK' ? "bg-emerald-600/20 text-emerald-500 border border-emerald-600" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700")}
                                        >
                                            <CheckCircle size={20} /> Mark OK
                                        </button>

                                        <button
                                            onClick={() => {
                                                handleUpdateResult(selectedRun, viewResult.point_id, 'NG')
                                                setViewResult({ ...viewResult, result: 'NG', manual_override: true })
                                            }}
                                            className={cn("px-6 py-3 rounded-lg font-bold flex items-center gap-2 transition",
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
