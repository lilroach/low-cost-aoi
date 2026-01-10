import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Home, Target } from 'lucide-react'
import { cn } from '../lib/utils'

interface MotionControlsProps {
    onJog: (axis: string, distance: number) => void
    stepSize: number
    setStepSize: (size: number) => void
    userRole: string | null
    alignState: string
}

export function MotionControls({ onJog, stepSize, setStepSize, userRole, alignState }: MotionControlsProps) {
    const isLocked = userRole === 'operator' && alignState === 'idle'

    return (
        <div className={cn("bg-zinc-900 rounded-xl p-4 border border-zinc-800 flex flex-col items-center gap-4 transition-opacity",
            isLocked ? "opacity-30 pointer-events-none grayscale" : "")}>
            <h3 className="text-xs font-bold text-zinc-500 uppercase flex items-center gap-2 w-full">
                <Target size={14} /> Motion Control
            </h3>
            <div className="grid grid-cols-3 gap-2">
                <div></div>
                <button onMouseDown={() => onJog('y', -1 * stepSize)} className="w-14 h-12 bg-zinc-800 rounded flex items-center justify-center hover:bg-blue-600 transition active:scale-95 border border-zinc-700"><ArrowUp size={20} /></button>
                <div></div>
                <button onMouseDown={() => onJog('x', -1 * stepSize)} className="w-14 h-12 bg-zinc-800 rounded flex items-center justify-center hover:bg-blue-600 transition active:scale-95 border border-zinc-700"><ArrowLeft size={20} /></button>
                <button className="w-14 h-12 bg-yellow-900/20 text-yellow-500 rounded flex items-center justify-center border border-yellow-700/50 hover:bg-yellow-900/40 active:scale-95"><Home size={18} /></button>
                <button onMouseDown={() => onJog('x', 1 * stepSize)} className="w-14 h-12 bg-zinc-800 rounded flex items-center justify-center hover:bg-blue-600 transition active:scale-95 border border-zinc-700"><ArrowRight size={20} /></button>
                <div></div>
                <button onMouseDown={() => onJog('y', 1 * stepSize)} className="w-14 h-12 bg-zinc-800 rounded flex items-center justify-center hover:bg-blue-600 transition active:scale-95 border border-zinc-700"><ArrowDown size={20} /></button>
            </div>

            <div className="flex bg-zinc-950 p-1 rounded-lg border border-zinc-800 w-full">
                {[0.1, 1, 10, 50].map(s => (
                    <button key={s} onClick={() => setStepSize(s)} className={cn("flex-1 py-1 text-xs font-mono rounded", stepSize === s ? "bg-blue-600 text-white" : "text-zinc-500 hover:text-zinc-300")}>{s}</button>
                ))}
            </div>
        </div>
    )
}
