import React, { useCallback } from 'react'
import { Target, Play, CheckCircle } from 'lucide-react'
import { cn } from '../../lib/utils'
import { useApp } from '../../context/AppContext'
import { useMotion } from '../../context/MotionContext'
import { useAlignment } from '../../hooks/useAlignment'
import { useOrchestrator } from '../../hooks/useOrchestrator'

export default React.memo(function RunView() {
    const {
        program, progList, fetchProgram,
        alignState, setAlignState,
        partNo, setPartNo, batchNo, setBatchNo
    } = useApp()

    const { status, moveToAbsolute } = useMotion()

    // Hooks for Run Logic
    const {
        currentAlignRefIndex, startAlignment: internalStartAlignment, confirmCurrentRef: internalConfirmCurrentRef
    } = useAlignment(program, status, moveToAbsolute)

    const { isRunning, runIndex } = useOrchestrator(alignState)

    // Handlers mapped to specialized logic
    const handleLoad = async (name: string) => {
        await fetch(`/api/program/load/${name}`, { method: 'POST' })
        fetchProgram()
    }

    const calculateAndRun = useCallback(async (runtimeRefs: any[]) => {
        setAlignState('calculating')
        try {
            await fetch('/api/alignment/calculate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ program_refs: program.refs, runtime_refs: runtimeRefs })
            })
            await fetch('/api/orchestrator/run', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ program_name: program.name, part_no: partNo, batch_no: batchNo })
            })
            setAlignState('running')
        } catch (e) {
            alert("Calculation or Run failed")
            setAlignState('idle')
        }
    }, [program, partNo, batchNo, setAlignState])

    const startAlignment = async () => {
        await internalStartAlignment()
        setAlignState('aligning_ref')
    }

    const confirmCurrentRef = async () => {
        const result = await internalConfirmCurrentRef()
        if (result && Array.isArray(result)) {
            // All refs confirmed, proceed to calculate and run
            calculateAndRun(result)
        }
    }

    return (
        <div className="bg-zinc-900 p-5 rounded-2xl border border-zinc-800 text-center space-y-5 shadow-xl shadow-black/10">
            <div className="space-y-2">
                <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">Run Setup</div>
                <h3 className="text-xl font-bold text-white tracking-tight">{program.name || "No Program Loaded"}</h3>
                <div className="flex items-center justify-center gap-2 text-xs text-zinc-500">
                    <span className="rounded-full border border-zinc-800 bg-zinc-950 px-2.5 py-1 font-mono">{program.points.length} Points</span>
                    <span className="rounded-full border border-zinc-800 bg-zinc-950 px-2.5 py-1 font-mono">{program.refs.length} Refs</span>
                </div>
            </div>

            {alignState === 'idle' ? (
                <div className="space-y-4">
                    <div className="flex flex-col gap-1.5 text-left">
                        <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider ml-1">Inspection Program</label>
                        <select
                            value={program.name === "Untitled" ? "" : program.name}
                            onChange={(e) => { if (e.target.value) handleLoad(e.target.value) }}
                            className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm focus:border-emerald-500 outline-none appearance-none cursor-pointer transition-colors"
                        >
                            <option value="" disabled>-- Select Program --</option>
                            {progList.map((p: any) => (
                                <option key={p.name} value={p.name}>{p.name} ({p.points_count} pts)</option>
                            ))}
                        </select>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1.5 text-left">
                            <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider ml-1">Part No.</label>
                            <input
                                value={partNo} onChange={(e) => setPartNo(e.target.value)}
                                placeholder="e.g. PCB-1001"
                                className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm focus:border-emerald-500 outline-none transition-colors"
                            />
                        </div>
                        <div className="space-y-1.5 text-left">
                            <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider ml-1">Batch No.</label>
                            <input
                                value={batchNo} onChange={(e) => setBatchNo(e.target.value)}
                                placeholder="e.g. 2024-01-A"
                                className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm focus:border-emerald-500 outline-none transition-colors"
                            />
                        </div>
                    </div>

                    <button
                        onClick={startAlignment}
                        disabled={program.points.length === 0 || !partNo || !batchNo}
                        className={cn("w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-3 transition-all border",
                            (program.points.length === 0 || !partNo || !batchNo) ? "bg-zinc-800 text-zinc-500 border-zinc-800 cursor-not-allowed" : "bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500 shadow-lg shadow-emerald-950/40")}
                    >
                        <Play fill="currentColor" /> START RUN
                    </button>

                    {(!partNo || !batchNo) && program.points.length > 0 && (
                        <div className="text-[10px] text-red-400 font-medium">* Please enter Part No. and Batch No. to start</div>
                    )}
                </div>
            ) : alignState === 'aligning_ref' ? (
                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
                    <div className="bg-blue-900/30 border border-blue-500/50 p-4 rounded-xl text-left">
                        <h4 className="font-bold text-blue-400 mb-2 flex items-center justify-center gap-2">
                            <Target className="animate-pulse" /> Aligning Ref {currentAlignRefIndex + 1}
                        </h4>
                        <p className="text-xs text-zinc-300 mb-4">
                            Machine moved to recorded Ref position.<br />
                            Use joystick to perfectly align the crosshair to the actual mark, then confirm.
                        </p>
                        <button
                            onClick={confirmCurrentRef}
                            className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg transition shadow-lg shadow-blue-950/30"
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
})
