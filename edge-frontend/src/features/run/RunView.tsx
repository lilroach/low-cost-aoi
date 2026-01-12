import { Target, Play, CheckCircle } from 'lucide-react'
import { cn } from '../../lib/utils'

interface RunViewProps {
    program: any
    progList: any[]
    handleLoad: (name: string) => void
    alignState: string
    currentAlignRefIndex: number
    startAlignment: () => void
    confirmCurrentRef: () => void
    runIndex: number
    isRunning: boolean
    calculateAndRun: (refs: any[]) => Promise<void>

    // Metadata State (Managed here or passed down? Better passed down to keep App as state container)
    partNo: string
    setPartNo: (v: string) => void
    batchNo: string
    setBatchNo: (v: string) => void
}

export default function RunView({
    program, progList, handleLoad, alignState, currentAlignRefIndex,
    startAlignment, confirmCurrentRef, runIndex, isRunning,
    partNo, setPartNo, batchNo, setBatchNo
}: RunViewProps) {

    return (
        <div className="bg-zinc-900 p-6 rounded-xl border border-zinc-800 text-center space-y-4">
            <h3 className="text-xl font-bold text-white">{program.name || "No Program Loaded"}</h3>
            <p className="text-zinc-500 text-sm">{program.points.length} Points • {program.refs.length} Refs</p>

            {alignState === 'idle' ? (
                <div className="space-y-4">
                    {/* Program Selector */}
                    <div className="flex flex-col gap-1 text-left">
                        <label className="text-[10px] text-zinc-500 font-bold uppercase ml-1">Inspection Program</label>
                        <select
                            value={program.name === "Untitled" ? "" : program.name}
                            onChange={(e) => {
                                if (e.target.value) handleLoad(e.target.value)
                            }}
                            className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:border-emerald-500 outline-none appearance-none cursor-pointer"
                        >
                            <option value="" disabled>-- Select Program --</option>
                            {progList.map((p: any) => (
                                <option key={p.name} value={p.name}>{p.name} ({p.points_count} pts)</option>
                            ))}
                        </select>
                    </div>

                    <div className="flex gap-2">
                        <div className="flex-1 space-y-1 text-left">
                            <label className="text-[10px] text-zinc-500 font-bold uppercase ml-1">Part No.</label>
                            <input
                                value={partNo} onChange={(e) => setPartNo(e.target.value)}
                                placeholder="e.g. PCB-1001"
                                className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:border-emerald-500 outline-none"
                            />
                        </div>
                        <div className="flex-1 space-y-1 text-left">
                            <label className="text-[10px] text-zinc-500 font-bold uppercase ml-1">Batch No.</label>
                            <input
                                value={batchNo} onChange={(e) => setBatchNo(e.target.value)}
                                placeholder="e.g. 2024-01-A"
                                className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:border-emerald-500 outline-none"
                            />
                        </div>
                    </div>

                    <button
                        onClick={startAlignment}
                        disabled={program.points.length === 0 || !partNo || !batchNo}
                        className={cn("w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-3 transition-all",
                            (program.points.length === 0 || !partNo || !batchNo) ? "bg-zinc-800 text-zinc-500 cursor-not-allowed" : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/20")}
                    >
                        <Play fill="currentColor" /> START RUN
                    </button>

                    {(!partNo || !batchNo) && program.points.length > 0 && (
                        <div className="text-[10px] text-red-400 font-medium">
                            * Please enter Part No. and Batch No. to start
                        </div>
                    )}
                </div>
            ) : alignState === 'aligning_ref' ? (
                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
                    <div className="bg-blue-900/30 border border-blue-500/50 p-4 rounded-lg">
                        <h4 className="font-bold text-blue-400 mb-2 flex items-center justify-center gap-2">
                            <Target className="animate-pulse" /> Aligning Ref {currentAlignRefIndex + 1}
                        </h4>
                        <p className="text-xs text-zinc-300 mb-4">
                            Machine moved to recorded Ref position.<br />
                            Use joystick to perfectly align the crosshair to the actual mark, then confirm.
                        </p>
                        <button
                            onClick={confirmCurrentRef}
                            className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg transition"
                        >
                            CONFIRM POSITION
                        </button>
                    </div>
                </div>
            ) : (
                <div className="py-4 text-emerald-500 font-bold animate-pulse flex flex-col items-center justify-center gap-2">
                    <div className="flex items-center gap-2"><CheckCircle size={20} /> INSPECTING...</div>
                    {isRunning && <span className="text-xs text-emerald-400">Processing Point #{runIndex}</span>}
                </div>
            )}
        </div>
    )
}
