import React, { useState } from 'react'
import { MapPin, Target, Save, List as ListIcon, Trash2, FileDown, Eye, GripVertical, Edit2, X, Check } from 'lucide-react'
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
    handleUpdatePoints: (points: any[]) => void
    onMoveToPoint: (p: any) => void
}

export default function TeachingView({
    programName, setProgramName, handleSave, progList, handleLoad, handleExport, handleDelete,
    program, handleRecordRef, handleRecordPoint, handleClear, handleUpdatePoints, onMoveToPoint
}: TeachingViewProps) {

    // --- State for Editing ---
    const [editingId, setEditingId] = useState<number | null>(null)
    const [editValues, setEditValues] = useState<{ x: string, y: string }>({ x: '', y: '' })

    // --- State for Drag & Drop ---
    const [draggedIdx, setDraggedIdx] = useState<number | null>(null)

    // Handlers
    const startEditing = (p: any) => {
        setEditingId(p.id)
        setEditValues({ x: p.x.toString(), y: p.y.toString() })
    }

    const saveEdit = () => {
        if (editingId === null) return
        const x = parseFloat(editValues.x)
        const y = parseFloat(editValues.y)

        if (isNaN(x) || isNaN(y)) {
            alert("Invalid coordinates")
            return
        }

        const newPoints = program.points.map((p: any) => {
            if (p.id === editingId) return { ...p, x, y }
            return p
        })
        handleUpdatePoints(newPoints)
        setEditingId(null)
    }

    const cancelEdit = () => {
        setEditingId(null)
    }

    const deletePoint = (id: number) => {
        // Renumber points? Or keep IDs?
        // Usually keeping IDs unique is better, but simple reordering might want re-indexing 
        // if purely sequential. Let's just remove for now.
        const newPoints = program.points.filter((p: any) => p.id !== id)
        handleUpdatePoints(newPoints)
    }

    // Drag Handlers
    const onDragStart = (e: React.DragEvent, index: number) => {
        setDraggedIdx(index)
        e.dataTransfer.effectAllowed = "move"
        // Transparent drag image potentially?
    }

    const onDragOver = (e: React.DragEvent, index: number) => {
        e.preventDefault() // Allow drop
        if (draggedIdx === null) return
        if (draggedIdx !== index) {
            // Optional: visual placeholder?
        }
    }

    const onDrop = (e: React.DragEvent, index: number) => {
        e.preventDefault()
        if (draggedIdx === null) return

        // Reorder
        const items = [...program.points]
        const [movedItem] = items.splice(draggedIdx, 1)
        items.splice(index, 0, movedItem)

        handleUpdatePoints(items)
        setDraggedIdx(null)
    }

    return (
        <div className="flex-1 overflow-y-auto min-h-0 flex flex-col gap-4">
            {/* Program Management */}
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
                                    <button onClick={() => handleExport(p.name)} title="Export G-code" className="p-1.5 hover:bg-blue-900/30 text-zinc-500 hover:text-blue-400 rounded"><FileDown size={14} /></button>
                                    <button onClick={() => handleDelete(p.name)} title="Delete" className="p-1.5 hover:bg-red-900/30 text-zinc-500 hover:text-red-400 rounded"><Trash2 size={14} /></button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Teaching Refs */}
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

            {/* Points List */}
            <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800 space-y-4 flex-1 flex flex-col min-h-0">
                <div className="flex justify-between items-center">
                    <h3 className="font-bold flex items-center gap-2 text-zinc-300"><ListIcon size={16} /> Points ({program.points.length})</h3>
                    <button onClick={handleClear} className="text-red-500 p-2 hover:bg-red-900/20 rounded"><Trash2 size={16} /></button>
                </div>

                <div className="flex-1 bg-zinc-950 rounded border border-zinc-800 overflow-y-auto p-2 space-y-1">
                    {program.points.length === 0 && <div className="text-zinc-600 text-center py-4 text-xs">No points recorded</div>}
                    {program.points.map((p: any, index: number) => (
                        <div
                            key={p.id}
                            draggable={editingId === null}
                            onDragStart={(e) => onDragStart(e, index)}
                            onDragOver={(e) => onDragOver(e, index)}
                            onDrop={(e) => onDrop(e, index)}
                            className={cn("group flex items-center gap-2 px-2 py-1.5 rounded transition border border-transparent",
                                draggedIdx === index ? "opacity-30 border-blue-500" : "hover:bg-zinc-900 hover:border-zinc-800",
                                editingId === p.id ? "bg-zinc-900 border-blue-900/50" : "bg-zinc-900/30"
                            )}>

                            {/* Drag Handle */}
                            <GripVertical size={12} className="text-zinc-700 cursor-grab active:cursor-grabbing flex-shrink-0" />

                            <span className="text-[10px] text-zinc-500 w-6 font-mono">#{index + 1}</span>

                            {editingId === p.id ? (
                                <div className="flex flex-1 items-center gap-2">
                                    <div className="flex item-center gap-1">
                                        <span className="text-[10px] text-zinc-600">X</span>
                                        <input
                                            value={editValues.x}
                                            onChange={e => setEditValues(prev => ({ ...prev, x: e.target.value }))}
                                            className="w-12 bg-black border border-zinc-700 rounded px-1 text-xs font-mono focus:border-blue-500 outline-none"
                                        />
                                    </div>
                                    <div className="flex item-center gap-1">
                                        <span className="text-[10px] text-zinc-600">Y</span>
                                        <input
                                            value={editValues.y}
                                            onChange={e => setEditValues(prev => ({ ...prev, y: e.target.value }))}
                                            className="w-12 bg-black border border-zinc-700 rounded px-1 text-xs font-mono focus:border-blue-500 outline-none"
                                        />
                                    </div>
                                    <button onClick={saveEdit} className="text-emerald-500 hover:bg-emerald-900/20 p-1 rounded"><Check size={14} /></button>
                                    <button onClick={cancelEdit} className="text-zinc-500 hover:bg-zinc-800 p-1 rounded"><X size={14} /></button>
                                </div>
                            ) : (
                                <>
                                    <div className="flex-1 font-mono text-xs text-zinc-300">
                                        {p.x.toFixed(2)}, {p.y.toFixed(2)}
                                    </div>

                                    {/* Actions */}
                                    <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => onMoveToPoint(p)} title="Move Camera Here" className="p-1.5 rounded text-zinc-500 hover:text-blue-400 hover:bg-blue-900/20"><Eye size={14} /></button>
                                        <button onClick={() => startEditing(p)} title="Edit Position" className="p-1.5 rounded text-zinc-500 hover:text-yellow-400 hover:bg-yellow-900/20"><Edit2 size={14} /></button>
                                        <button onClick={() => deletePoint(p.id)} title="Delete Point" className="p-1.5 rounded text-zinc-500 hover:text-red-400 hover:bg-red-900/20"><Trash2 size={14} /></button>
                                    </div>
                                </>
                            )}
                        </div>
                    ))}
                </div>

                <button onClick={handleRecordPoint} className="w-full py-3 bg-blue-600 hover:bg-blue-500 rounded font-bold transition flex items-center justify-center gap-2 text-white shadow-lg shadow-blue-900/20 flex-shrink-0">
                    <Target size={18} /> Record Point
                </button>
            </div>
        </div>
    )
}
