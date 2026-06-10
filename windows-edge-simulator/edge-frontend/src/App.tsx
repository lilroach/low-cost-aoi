import { useState } from 'react'
import { Crosshair, Camera, AlertTriangle, CheckCircle } from 'lucide-react'
import ReviewDashboard from './features/review/ReviewDashboard'
import TeachingView from './features/teaching/TeachingView'
import RunView from './features/run/RunView'
import CaptureView from './features/capture/CaptureView'
import TransferView from './features/transfer/TransferView'
import { LoginModal } from './components/LoginModal'
import { MotionControls } from './components/MotionControls'
import { AppProvider, useApp } from './context/AppContext'
import { MotionProvider, useMotion } from './context/MotionContext'
import { cn } from './lib/utils'
import { useOrchestrator } from './hooks/useOrchestrator'

function AppContent() {
    const {
        tab, setTab, userRole, setUserRole,
        program, alignState, setShowLogin
    } = useApp()

    const { status } = useMotion()
    const { isRunning, runIndex, runResults } = useOrchestrator(alignState)

    const [reticleSize, setReticleSize] = useState(100)

    const handleLogout = () => {
        setUserRole(null)
        setShowLogin(true)
        setTab('run')
    }

    if (!userRole) {
        return <LoginModal />
    }

    return (
        <div className="flex h-screen flex-col overflow-hidden bg-[#09090b] font-sans text-zinc-100">
            <LoginModal />

            {/* Header */}
            <header className="min-h-16 border-b border-zinc-800/80 flex flex-wrap items-center justify-between gap-3 px-4 sm:px-5 py-3 bg-zinc-950/80 backdrop-blur">
                <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 bg-blue-600 rounded-lg flex shrink-0 items-center justify-center font-bold text-sm shadow-lg shadow-blue-950/40">E</div>
                    <div className="leading-tight min-w-0">
                        <div className="font-semibold tracking-tight text-white">AOI Edge</div>
                        <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-600">Inspection Console</div>
                    </div>
                    <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded uppercase ml-1 sm:ml-2 shrink-0",
                        userRole === 'engineer' ? "bg-blue-900/50 text-blue-400 border border-blue-800" : "bg-zinc-800 text-zinc-400 border border-zinc-700")}>
                        {userRole}
                    </span>
                </div>
                <div className="flex max-w-full items-center gap-1.5 overflow-x-auto text-sm font-medium text-zinc-400 bg-zinc-900/70 border border-zinc-800 rounded-2xl sm:rounded-full p-1">
                    {/* Capture is available to all */}
                    <button onClick={() => setTab('capture')} className={cn("shrink-0 px-4 py-2 rounded-full hover:bg-zinc-800 hover:text-zinc-200 transition-colors", tab === 'capture' && "bg-blue-600 text-white shadow-sm shadow-blue-950/40")}>Capture</button>

                    {userRole === 'engineer' && (
                        <>
                            <button onClick={() => setTab('motion')} className={cn("shrink-0 px-4 py-2 rounded-full hover:bg-zinc-800 hover:text-zinc-200 transition-colors", tab === 'motion' && "bg-blue-600 text-white shadow-sm shadow-blue-950/40")}>Motion</button>
                            <button onClick={() => setTab('teaching')} className={cn("shrink-0 px-4 py-2 rounded-full hover:bg-zinc-800 hover:text-zinc-200 transition-colors", tab === 'teaching' && "bg-blue-600 text-white shadow-sm shadow-blue-950/40")}>Teaching</button>
                        </>
                    )}
                    <button onClick={() => setTab('run')} className={cn("shrink-0 px-4 py-2 rounded-full hover:bg-zinc-800 hover:text-zinc-200 transition-colors", tab === 'run' && "bg-blue-600 text-white shadow-sm shadow-blue-950/40")}>Run</button>
                    <button onClick={() => setTab('review')} className={cn("shrink-0 px-4 py-2 rounded-full hover:bg-zinc-800 hover:text-zinc-200 transition-colors", tab === 'review' && "bg-blue-600 text-white shadow-sm shadow-blue-950/40")}>Review</button>
                    {userRole === 'engineer' && (
                        <button onClick={() => setTab('transfer')} className={cn("shrink-0 px-4 py-2 rounded-full hover:bg-zinc-800 hover:text-zinc-200 transition-colors", tab === 'transfer' && "bg-blue-600 text-white shadow-sm shadow-blue-950/40")}>Transfer</button>
                    )}

                    <div className="w-px h-6 bg-zinc-800 mx-1 self-center shrink-0"></div>
                    <button onClick={handleLogout} className="shrink-0 text-zinc-500 hover:text-white text-xs px-3 py-2 rounded-full hover:bg-zinc-800 transition-colors">Logout</button>
                </div>
            </header>

            <main className="flex-1 p-4 sm:p-5 lg:p-6 grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-6 overflow-y-auto lg:overflow-hidden min-h-0">
                {/* LEFT: Camera & Live Status */}
                <div className={cn("flex flex-col gap-5 min-h-0", (tab === 'capture' || tab === 'transfer') ? "lg:col-span-12 h-full" : "lg:col-span-8")}>
                    {tab === 'capture' ? (
                        <CaptureView />
                    ) : tab === 'transfer' ? (
                        <TransferView />
                    ) : (
                        <div className="bg-black rounded-2xl border border-zinc-800 overflow-hidden relative aspect-video shadow-2xl shadow-black/40 flex items-center justify-center group">
                            <img src="/api/camera/feed" className="w-full h-full object-contain absolute inset-0" alt="camera feed" />
                            <div className="absolute inset-0 flex items-center justify-center opacity-30 pointer-events-none">
                                <Crosshair size={24} className="text-zinc-400" />
                            </div>

                            {(tab === 'teaching' || alignState === 'aligning_ref') && (
                                <div
                                    className="absolute pointer-events-none border-2 border-yellow-400 rounded-full shadow-[0_0_10px_rgba(250,204,21,0.5)] z-10 flex items-center justify-center"
                                    style={{ width: reticleSize, height: reticleSize }}
                                >
                                    <div className="w-1 h-1 bg-yellow-400 rounded-full"></div>
                                </div>
                            )}

                            <div className="absolute top-4 left-4 bg-red-500/90 text-white text-[10px] font-bold px-2 py-0.5 rounded animate-pulse z-20">LIVE</div>

                            {isRunning && (
                                <div className="absolute top-4 right-4 bg-blue-600/90 text-white px-4 py-2 rounded-lg shadow-lg flex items-center text-sm z-20">
                                    Running Point {runIndex}/{program.points.length}
                                </div>
                            )}

                            {(tab === 'teaching' || alignState === 'aligning_ref') && (
                                <div className="absolute bottom-4 left-4 right-16 flex items-center gap-3 bg-black/60 backdrop-blur p-2 rounded-lg border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                                    <span className="text-[10px] font-bold text-yellow-500 whitespace-nowrap">TARGET SIZE</span>
                                    <input
                                        type="range" min="20" max="400"
                                        value={reticleSize} onChange={(e) => setReticleSize(Number(e.target.value))}
                                        className="w-full h-1 bg-zinc-600 rounded-lg appearance-none cursor-pointer accent-yellow-500"
                                    />
                                    <span className="text-[10px] font-mono text-zinc-300 w-8">{reticleSize}px</span>
                                </div>
                            )}

                            <button className="absolute bottom-4 right-4 bg-zinc-800/80 hover:bg-zinc-700/90 text-white p-2 rounded-lg backdrop-blur border border-zinc-700 transition z-20" title="Snapshot">
                                <Camera size={20} />
                            </button>
                        </div>
                    )}

                    {tab === 'run' && runResults.length > 0 && (
                        <div className="flex-1 bg-zinc-900 rounded-2xl border border-zinc-800 p-4 overflow-y-auto max-h-[300px] shadow-xl shadow-black/20">
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-[0.18em]">Inspection Results</h3>
                                <span className="text-[10px] font-mono text-zinc-600">{runResults.length} records</span>
                            </div>
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
                {tab !== 'capture' && tab !== 'transfer' && (
                    <div className="lg:col-span-4 flex flex-col gap-4 min-h-0">
                        <MotionControls />

                        <div className="bg-zinc-900 rounded-2xl p-4 border border-zinc-800 shadow-xl shadow-black/10">
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

                        <div className="flex-1 overflow-y-auto min-h-0 flex flex-col gap-4 pr-1">
                            {tab === 'motion' && (
                                <div className="text-zinc-500 text-sm text-center p-4">
                                    Use the controls above to verify machine movement.
                                </div>
                            )}

                            {tab === 'teaching' && <TeachingView />}
                            {tab === 'run' && <RunView />}
                            {tab === 'review' && (
                                <div className="h-full min-h-[520px] bg-zinc-900 rounded-2xl border border-zinc-800 overflow-hidden">
                                    <ReviewDashboard />
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </main>
        </div>
    )
}

export default function App() {
    return (
        <AppProvider>
            <MotionProvider>
                <AppContent />
            </MotionProvider>
        </AppProvider>
    )
}
