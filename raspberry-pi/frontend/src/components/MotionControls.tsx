import React from 'react'
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Home, Target } from 'lucide-react'
import { cn } from '../lib/utils'
import { useMotion } from '../context/MotionContext'
import { useApp } from '../context/AppContext'

export const MotionControls = React.memo(() => {
    const { stepSize, setStepSize, handleJog, handleHome } = useMotion()
    const { userRole, alignState } = useApp()

    const isLocked = userRole === 'operator' && alignState === 'idle'

    return (
        <div className={cn("bg-zinc-900 rounded-2xl p-4 border border-zinc-800 flex flex-col items-center gap-4 transition-opacity shadow-xl shadow-black/10",
            isLocked ? "opacity-30 pointer-events-none grayscale" : "")}>
            <div className="w-full">
                <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">Machine</div>
                <h3 className="text-sm font-bold text-zinc-300 flex items-center gap-2 mt-1">
                    <Target size={14} /> Motion Control
                </h3>
            </div>
            <div className="grid grid-cols-3 gap-2" aria-label="Jog controls">
                <div></div>
                <button onMouseDown={() => handleJog('y', -1 * stepSize)} className="w-14 h-12 bg-zinc-800 rounded-lg flex items-center justify-center hover:bg-blue-600 transition active:scale-95 border border-zinc-700" title="Jog Y-"><ArrowUp size={20} /></button>
                <div></div>
                <button onMouseDown={() => handleJog('x', -1 * stepSize)} className="w-14 h-12 bg-zinc-800 rounded-lg flex items-center justify-center hover:bg-blue-600 transition active:scale-95 border border-zinc-700" title="Jog X-"><ArrowLeft size={20} /></button>
                <button onClick={handleHome} className="w-14 h-12 bg-yellow-900/20 text-yellow-500 rounded-lg flex items-center justify-center border border-yellow-700/50 hover:bg-yellow-900/40 active:scale-95" title="Home machine"><Home size={18} /></button>
                <button onMouseDown={() => handleJog('x', 1 * stepSize)} className="w-14 h-12 bg-zinc-800 rounded-lg flex items-center justify-center hover:bg-blue-600 transition active:scale-95 border border-zinc-700" title="Jog X+"><ArrowRight size={20} /></button>
                <div></div>
                <button onMouseDown={() => handleJog('y', 1 * stepSize)} className="w-14 h-12 bg-zinc-800 rounded-lg flex items-center justify-center hover:bg-blue-600 transition active:scale-95 border border-zinc-700" title="Jog Y+"><ArrowDown size={20} /></button>
            </div>

            <div className="w-full space-y-2">
                <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-600">
                    <span>Step Size</span>
                    <span className="font-mono tracking-normal text-zinc-500">{stepSize} mm</span>
                </div>
                <div className="flex bg-zinc-950 p-1 rounded-xl border border-zinc-800 w-full">
                    {[0.1, 1, 10, 50].map(s => (
                        <button key={s} onClick={() => setStepSize(s)} className={cn("flex-1 py-1.5 text-xs font-mono rounded-lg transition-colors", stepSize === s ? "bg-blue-600 text-white" : "text-zinc-500 hover:text-zinc-300")}>{s}</button>
                    ))}
                </div>
            </div>
        </div>
    )
})
