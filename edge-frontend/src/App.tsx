import React, { useState, useEffect } from 'react'
import { Crosshair, Camera, AlertTriangle, CheckCircle } from 'lucide-react'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import ReviewDashboard from './features/review/ReviewDashboard'
import TeachingView from './features/teaching/TeachingView'
import RunView from './features/run/RunView'
import { LoginModal } from './components/LoginModal'
import { MotionControls } from './components/MotionControls'

export function cn(...inputs: (string | undefined | null | false)[]) {
    return twMerge(clsx(inputs))
}

function App() {
    // --- STATE ---
    const [tab, setTab] = useState<'motion' | 'teaching' | 'run' | 'review'>('motion')
    const [status, setStatus] = useState<any>({ machine: { x: 0, y: 0 }, work: { x: 0, y: 0 }, offset: { x: 0, y: 0 } })
    const [stepSize, setStepSize] = useState(10)

    // Program State
    const [program, setProgram] = useState<any>({ name: "Untitled", refs: [], points: [] })
    const [progList, setProgList] = useState<any[]>([])
    const [programName, setProgramName] = useState("")

    // Run State
    const [isRunning, setIsRunning] = useState(false)
    const [runResults, setRunResults] = useState<any[]>([])
    const [runIndex, setRunIndex] = useState(0)

    // Alignment State
    const [alignState, setAlignState] = useState<'idle' | 'aligning_ref' | 'calculating' | 'running'>('idle')
    const [currentAlignRefIndex, setCurrentAlignRefIndex] = useState(0)
    const [runtimeRefs, setRuntimeRefs] = useState<any[]>([])

    // Auth State
    const [userRole, setUserRole] = useState<'engineer' | 'operator' | null>(null) // null = not logged in
    const [showLogin, setShowLogin] = useState(true) // Start with login screen



    // --- API CALLS ---
    const fetchStatus = async () => {
        try {
            const res = await fetch('/api/motion/status')
            setStatus(await res.json())
        } catch (e) { }
    }
    const fetchProgram = async () => {
        try {
            const res = await fetch('/api/program/current')
            setProgram(await res.json())
        } catch (e) { }
    }
    const fetchProgList = async () => {
        try {
            const res = await fetch('/api/program/list')
            setProgList(await res.json())
        } catch (e) { }
    }


    useEffect(() => {
        const i = setInterval(fetchStatus, 500)
        fetchProgram()
        fetchProgList()
        return () => clearInterval(i)
    }, [])

    // --- HANDLERS ---
    const handleJog = async (axis: string, dist: number) => {
        // Prevent operator from jogging unless explicitly allowed? 
        // For now, allow Operator to jog for alignment? Or strict no?
        // User Plan: "Operator: Run/Reset only". Alignment might need jog.
        // Let's allow Jog only if not strictly "locked out".
        // Actually, let's strictly follow: Operator = Run Only.
        // But Alignment requires Jogging. So Operator MUST be able to Jog during Alignment Wizard.
        // We will guard this in UI enabling/disabling.

        await fetch('/api/motion/jog', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ axis, distance: dist })
        })
        fetchStatus()
    }

    const handleHome = async () => {
        if (!confirm("Return to Machine Zero?")) return
        await fetch('/api/motion/home', { method: 'POST' })
        fetchStatus()
    }

    const moveToAbsolute = async (x: number, y: number) => {
        // Calculate diff because our API is relative jog
        // Note: In real app, we should have an absolute move API
        const dx = x - status.machine.x
        const dy = y - status.machine.y

        if (Math.abs(dx) > 0.1) await handleJog('x', dx)
        if (Math.abs(dy) > 0.1) await handleJog('y', dy)
    }

    const handleRecordRef = async (idx: number) => {
        await fetch(`/api/program/record/ref/${idx}`, { method: 'POST' })
        fetchProgram()
    }
    const handleRecordPoint = async () => {
        await fetch(`/api/program/record/point`, { method: 'POST' })
        fetchProgram()
    }
    const handleUpdatePoints = async (points: any[]) => {
        await fetch('/api/program/points', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ points })
        })
        fetchProgram()
    }
    const handleClear = async () => {
        if (confirm("Clear current program?")) {
            await fetch(`/api/program/clear`, { method: 'DELETE' })
            fetchProgram()
        }
    }
    const handleSave = async () => {
        if (!programName) return alert("Enter name")
        await fetch(`/api/program/save/${programName}`, { method: 'POST' })
        fetchProgList()
        alert("Saved!")
    }
    const handleLoad = async (name: string) => {
        await fetch(`/api/program/load/${name}`, { method: 'POST' })
        setProgramName(name)
        fetchProgram()
        setAlignState('idle')
        setRunResults([])
    }
    const handleDelete = async (name: string) => {
        if (!confirm(`Are you sure you want to delete "${name}"?`)) return
        await fetch(`/api/program/${name}`, { method: 'DELETE' })
        if (programName === name) {
            setProgramName("")
            setProgram({ name: "Untitled", refs: [], points: [] })
        }
        fetchProgList()
    }
    const handleExport = async (name: string) => {
        // Trigger file download
        window.open(`/api/program/export/${name}/gcode`, '_blank')
    }

    // --- ALIGNMENT FLOW based on run refs ---

    // --- ALIGNMENT FLOW ---
    const startAlignment = async () => {
        if (program.refs.length < 2) return alert("Need at least 2 Refs to align!")
        setAlignState('aligning_ref')
        setCurrentAlignRefIndex(0)
        setRuntimeRefs([])

        // Move to Ref 1
        await moveToAbsolute(program.refs[0].x, program.refs[0].y)
    }

    const confirmCurrentRef = async () => {
        // Record current position as the "Runtime" Ref position
        const p = {
            id: program.refs[currentAlignRefIndex].id,
            x: status.machine.x,
            y: status.machine.y,
            type: 'ref'
        }
        const newRefs = [...runtimeRefs, p]
        setRuntimeRefs(newRefs)

        // Next Ref?
        const nextIdx = currentAlignRefIndex + 1
        if (nextIdx < program.refs.length) {
            setCurrentAlignRefIndex(nextIdx)
            // Move to next Ref teaching position
            await moveToAbsolute(program.refs[nextIdx].x, program.refs[nextIdx].y)
        } else {
            // Done Aligning -> Calculate
            setAlignState('calculating')
            await calculateAndRun(newRefs)
        }
    }

    // --- ORCHESTRATOR POLLING ---
    useEffect(() => {
        let interval: any
        if (alignState === 'running') {
            interval = setInterval(async () => {
                try {
                    const res = await fetch('/api/orchestrator/status')
                    const data = await res.json()

                    if (data.is_running) {
                        setIsRunning(true)
                        setRunIndex(data.current_point_index)
                        // Update results gracefully
                        setRunResults(data.results)
                    } else {
                        // Job finished
                        setIsRunning(false)
                        setRunResults(data.results)
                        setAlignState('idle') // Return to idle
                        clearInterval(interval)
                    }
                } catch (e) {
                    console.error("Orchestrator poll failed", e)
                }
            }, 500)
        }
        return () => clearInterval(interval)
    }, [alignState])

    // Run Metadata State
    const [partNo, setPartNo] = useState("")
    const [batchNo, setBatchNo] = useState("")

    const calculateAndRun = async (refs: any[]) => {
        try {
            // 1. Calculate Alignment
            const res = await fetch('/api/program/align', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ run_refs: refs })
            })
            const data = await res.json()

            // 2. Start Backend Orchestrator
            setAlignState('running') // Start polling
            await fetch('/api/orchestrator/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    points: data.corrected_points,
                    part_no: partNo,
                    batch_no: batchNo
                })
            })

        } catch (e) {
            alert("Alignment Failed!")
            setAlignState('idle')
        }
    }

    // Removed old client-side loop function


    // --- UI COMPONENTS ---








    // Reticle State
    const [reticleSize, setReticleSize] = useState(100)

    const handleLogout = () => {
        setUserRole(null)
        setShowLogin(true)
        setTab('run')
    }

    return (
        <div className="min-h-screen bg-[#09090b] text-zinc-100 flex flex-col font-sans">
            <LoginModal show={showLogin} setShow={setShowLogin} setUserRole={setUserRole} setTab={setTab} />

            {/* Header */}
            <header className="h-14 border-b border-zinc-800 flex items-center justify-between px-6 bg-zinc-950/50 backdrop-blur">
                <div className="flex items-center gap-2">
                    <div className="w-6 h-6 bg-blue-600 rounded flex items-center justify-center font-bold text-xs">E</div>
                    <span className="font-semibold tracking-tight">AOI Edge</span>
                    {userRole && (
                        <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded uppercase ml-2",
                            userRole === 'engineer' ? "bg-blue-900/50 text-blue-400 border border-blue-800" : "bg-zinc-800 text-zinc-400 border border-zinc-700")}>
                            {userRole}
                        </span>
                    )}
                </div>
                {userRole && (
                    <div className="flex gap-2 text-sm font-medium text-zinc-400">
                        {/* Only Engineer sees Motion/Teaching Tabs */}
                        {userRole === 'engineer' && (
                            <>
                                <button onClick={() => setTab('motion')} className={cn("px-4 py-1.5 rounded-full hover:bg-zinc-800 transition-colors", tab === 'motion' && "bg-zinc-800 text-white")}>Motion</button>
                                <button onClick={() => setTab('teaching')} className={cn("px-4 py-1.5 rounded-full hover:bg-zinc-800 transition-colors", tab === 'teaching' && "bg-zinc-800 text-white")}>Teaching</button>
                            </>
                        )}
                        <button onClick={() => setTab('run')} className={cn("px-4 py-1.5 rounded-full hover:bg-zinc-800 transition-colors", tab === 'run' && "bg-zinc-800 text-white")}>Run</button>
                        <button onClick={() => setTab('review')} className={cn("px-4 py-1.5 rounded-full hover:bg-zinc-800 transition-colors", tab === 'review' && "bg-zinc-800 text-white")}>Review</button>

                        <div className="w-px h-6 bg-zinc-800 mx-2 self-center"></div>
                        <button onClick={handleLogout} className="text-zinc-500 hover:text-white text-xs px-2">Logout</button>
                    </div>
                )}
            </header>

            <main className="flex-1 p-6 grid grid-cols-12 gap-6 overflow-hidden">

                {/* LEFT: Camera & Live Status */}
                <div className="col-span-8 flex flex-col gap-6">
                    <div className="bg-black rounded-xl border border-zinc-800 overflow-hidden relative aspect-video shadow-2xl flex items-center justify-center group">
                        <img src="/api/camera/feed" className="w-full h-full object-contain absolute inset-0" />

                        {/* Default Crosshair (Always visible or toggleable?) - Let's keep it subtle */}
                        <div className="absolute inset-0 flex items-center justify-center opacity-30 pointer-events-none">
                            <Crosshair size={24} className="text-zinc-400" />
                        </div>

                        {/* Alignment Reticle (Visible in Teaching Mode or Alignment) */}
                        {(tab === 'teaching' || alignState === 'aligning_ref') && (
                            <div
                                className="absolute pointer-events-none border-2 border-yellow-400 rounded-full shadow-[0_0_10px_rgba(250,204,21,0.5)] z-10 flex items-center justify-center"
                                style={{ width: reticleSize, height: reticleSize }}
                            >
                                <div className="w-1 h-1 bg-yellow-400 rounded-full"></div>
                            </div>
                        )}

                        <div className="absolute top-4 left-4 bg-red-500/90 text-white text-[10px] font-bold px-2 py-0.5 rounded animate-pulse z-20">LIVE</div>

                        {/* Run Overlay */}
                        {isRunning && (
                            <div className="absolute top-4 right-4 bg-blue-600/90 text-white px-4 py-2 rounded-lg shadow-lg flex items-col text-sm z-20">
                                Running Point {runIndex}/{program.points.length}
                            </div>
                        )}

                        {/* Reticle Control Slider (Overlay) - Only Engineer or Alignment */}
                        {(tab === 'teaching' || alignState === 'aligning_ref') && (
                            <div className="absolute bottom-4 left-4 right-16 flex items-center gap-3 bg-black/60 backdrop-blur p-2 rounded-lg border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                                <span className="text-[10px] font-bold text-yellow-500 whitespace-nowrap">TARGET SIZE</span>
                                <input
                                    type="range" min="20" max="400"
                                    value={reticleSize} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setReticleSize(Number(e.target.value))}
                                    className="w-full h-1 bg-zinc-600 rounded-lg appearance-none cursor-pointer accent-yellow-500"
                                />
                                <span className="text-[10px] font-mono text-zinc-300 w-8">{reticleSize}px</span>
                            </div>
                        )}

                        {/* Snapshot Button Overlay */}
                        <button className="absolute bottom-4 right-4 bg-zinc-800/80 hover:bg-zinc-700/90 text-white p-2 rounded-lg backdrop-blur border border-zinc-700 transition z-20" title="Snapshot">
                            <Camera size={20} />
                        </button>
                    </div>

                    {/* Run Results List */}
                    {tab === 'run' && runResults.length > 0 && (
                        <div className="flex-1 bg-zinc-900 rounded-xl border border-zinc-800 p-4 overflow-y-auto max-h-[300px]">
                            <h3 className="text-sm font-bold text-zinc-400 mb-2 uppercase tracking-wider">Inspection Results</h3>
                            <div className="space-y-2">
                                {runResults.map((r: any, i: number) => (
                                    <div key={i} className="flex justify-between items-center bg-zinc-950 p-3 rounded border border-zinc-800">
                                        <div className="flex items-center gap-3">
                                            <span className="text-zinc-500 font-mono">#{r.point_id}</span>
                                            {r.result === 'NG' ?
                                                <span className="text-red-500 font-bold flex items-center gap-1"><AlertTriangle size={16} /> NG</span> :
                                                <span className="text-emerald-500 font-bold flex items-center gap-1"><CheckCircle size={16} /> OK</span>
                                            }
                                        </div>
                                        <div className="text-xs text-zinc-500">
                                            {r.detections.map((d: any) => d.label).join(', ')}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* RIGHT: Controls */}
                <div className="col-span-4 flex flex-col gap-4">

                    {/* Shared Motion Controls (Always Visible at Top now) */}
                    {/* Only enabled for Engineer OR during Alignment */}
                    <MotionControls onJog={handleJog} onHome={handleHome} stepSize={stepSize} setStepSize={setStepSize} userRole={userRole} alignState={alignState} />

                    {/* Status Card (Always visible) */}
                    <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-[10px] uppercase text-zinc-500 font-bold">Work X</label>
                                <div className="text-2xl font-mono text-blue-400">{status.work.x.toFixed(2)}</div>
                            </div>
                            <div>
                                <label className="text-[10px] uppercase text-zinc-500 font-bold">Work Y</label>
                                <div className="text-2xl font-mono text-cyan-400">{status.work.y.toFixed(2)}</div>
                            </div>
                        </div>
                    </div>

                    {/* Tab Specific Controls */}
                    <div className="flex-1 overflow-y-auto min-h-0 flex flex-col gap-4">

                        {tab === 'motion' && (
                            <div className="text-zinc-500 text-sm text-center p-4">
                                Use the controls below to verify machine movement.
                            </div>
                        )}


                        {tab === 'teaching' && (
                            <TeachingView
                                programName={programName}
                                setProgramName={setProgramName}
                                handleSave={handleSave}
                                progList={progList}
                                handleLoad={handleLoad}
                                handleExport={handleExport}
                                handleDelete={handleDelete}
                                program={program}
                                handleRecordRef={handleRecordRef}
                                handleRecordPoint={handleRecordPoint}
                                handleClear={handleClear}
                                handleUpdatePoints={handleUpdatePoints}
                                onMoveToPoint={(p: any) => moveToAbsolute(p.x, p.y)}
                            />
                        )}
                    </div>


                    {tab === 'run' && (
                        <RunView
                            program={program}
                            progList={progList}
                            handleLoad={handleLoad}
                            alignState={alignState}
                            currentAlignRefIndex={currentAlignRefIndex}
                            startAlignment={startAlignment}
                            confirmCurrentRef={confirmCurrentRef}
                            runIndex={runIndex}
                            isRunning={isRunning}
                            partNo={partNo}
                            setPartNo={setPartNo}
                            batchNo={batchNo}
                            setBatchNo={setBatchNo}
                            calculateAndRun={calculateAndRun}
                        />
                    )}

                    {tab === 'review' && (
                        <div className="h-full bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
                            <ReviewDashboard />
                        </div>
                    )}
                </div>
            </main>
        </div>
    )
}

export default App
