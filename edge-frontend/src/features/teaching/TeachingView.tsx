import { MapPin, Target, Save, List as ListIcon, Trash2, FileDown } from 'lucide-react'
import { cn } from '../../lib/utils'

interface TeachingViewProps {
    programName: string
    setProgramName: (name: string) => void
    handleSave: () => void
    progList: any[]
    handleLoad: (name: string) => void
    handleExport: (name: string) => void
    handleDelete: (name: string) => void
    program: any
    handleRecordRef: (idx: number) => void
    handleRecordPoint: () => void
    handleClear: () => void
}

export default function TeachingView({
    programName, setProgramName, handleSave, progList, handleLoad, handleExport, handleDelete,
    program, handleRecordRef, handleRecordPoint, handleClear
}: TeachingViewProps) {
    return (
        <div className="flex-1 overflow-y-auto min-h-0 flex flex-col gap-4">
            <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800 space-y-2">
                <div className="flex gap-2">
                    <input
                        value={programName} onChange={(e) => setProgramName(e.target.value)}
                        placeholder="Program Name"
                        className="flex-1 bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-xs focus:outline-none focus:border-blue-500"
                    />
                    <button onClick={handleSave} className="bg-zinc-800 hover:bg-zinc-700 px-3 py-2 rounded text-xs font-medium flex items-center justify-center gap-1"><Save size={14} /> Save</button>
                </div>

                {progList.length > 0 && (
                    <div className="space-y-1 max-h-48 overflow-y-auto border-t border-zinc-800 pt-2">
                        <h4 className="text-[10px] text-zinc-600 font-bold uppercase mb-1">Saved Programs</h4>
                        {progList.map((p: any) => (
                            <div key={p.name} className="flex justify-between items-center text-xs px-2 py-2 hover:bg-zinc-950 rounded border border-transparent hover:border-zinc-800 transition group/item">
                                <div onClick={() => handleLoad(p.name)} className="cursor-pointer flex-1">
                                    <div className="font-bold text-zinc-300">{p.name}</div>
                                    <div className="text-[10px] text-zinc-600">{p.points_count} points</div>
                                </div>

                                <div className="flex gap-1 opacity-0 group-hover/item:opacity-100 transition-opacity">
                                    <button
                                        onClick={() => handleExport(p.name)}
                                        title="Export G-code"
                                        className="p-1.5 hover:bg-blue-900/30 text-zinc-500 hover:text-blue-400 rounded"
                                    >
                                        <FileDown size={14} />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(p.name)}
                                        title="Delete"
                                        className="p-1.5 hover:bg-red-900/30 text-zinc-500 hover:text-red-400 rounded"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800 space-y-4">
                <h3 className="font-bold flex items-center gap-2 text-zinc-300"><MapPin size={16} /> Alignment Refs</h3>
                <p className="text-[10px] text-zinc-500 leading-tight">
                    Move camera to fiducial. Adjust yellow circle size to match. Record Ref.
                </p>
                <div className="flex gap-2">
                    {[1, 2, 3].map(i => {
                        const recorded = program.refs.find((r: any) => r.id === i)
                        return (
                            <button key={i} onClick={() => handleRecordRef(i)}
                                className={cn("flex-1 py-3 rounded border text-sm font-medium transition relative overflow-hidden",
                                    recorded ? "bg-emerald-900/20 border-emerald-800 text-emerald-400" : "bg-zinc-950 border-zinc-800 text-zinc-500 hover:border-zinc-700")}>
                                Ref {i}
                                {recorded && <div className="text-[9px] mt-1 font-mono">{recorded.x},{recorded.y}</div>}
                            </button>
                        )
                    })}
                </div>
            </div>

            <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800 space-y-4 flex-1 flex flex-col min-h-0">
                <div className="flex justify-between items-center">
                    <h3 className="font-bold flex items-center gap-2 text-zinc-300"><ListIcon size={16} /> Points ({program.points.length})</h3>
                    <button onClick={handleClear} className="text-red-500 p-2 hover:bg-red-900/20 rounded"><Trash2 size={16} /></button>
                </div>

                <button onClick={handleRecordPoint} className="w-full py-3 bg-blue-600 hover:bg-blue-500 rounded font-bold transition flex items-center justify-center gap-2 text-white shadow-lg shadow-blue-900/20">
                    <Target size={18} /> Record Point
                </button>

                <div className="flex-1 bg-zinc-950 rounded border border-zinc-800 overflow-y-auto p-2 space-y-1">
                    {program.points.map((p: any) => (
                        <div key={p.id} className="text-xs text-zinc-400 flex justify-between px-2 py-1 bg-zinc-900/50 rounded">
                            <span>#{p.id}</span>
                            <span className="font-mono">{p.x}, {p.y}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}
