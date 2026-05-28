import React, { useState } from 'react'
import { MapPin, Target, Save, List as ListIcon, Trash2, FileDown, Eye, GripVertical, Edit2, X, Check } from 'lucide-react'
import { cn } from '../../lib/utils'
import { useApp } from '../../context/AppContext'
import { useMotion } from '../../context/MotionContext'

export default React.memo(function TeachingView() {
    const {
        program, programName, setProgramName, progList,
        fetchProgram, fetchProgList
    } = useApp()

    const { handleRecordRef, handleRecordPoint, moveToAbsolute, handleUpdatePoints: contextHandleUpdatePoints } = useMotion()

    // --- State for Editing ---
    const [editingId, setEditingId] = useState<number | null>(null)
    const [editValues, setEditValues] = useState<{ x: string, y: string }>({ x: '', y: '' })

    // --- State for Drag & Drop ---
    const [draggedIdx, setDraggedIdx] = useState<number | null>(null)

    // Handlers
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
    }

    const handleDelete = async (name: string) => {
        if (!confirm(`Are you sure you want to delete "${name}"?`)) return
        await fetch(`/api/program/${name}`, { method: 'DELETE' })
        fetchProgList()
    }

    const handleExport = (name: string) => {
        window.open(`/api/program/export/${name}/gcode`, '_blank')
    }

    const handleClear = async () => {
        if (confirm("Clear current program?")) {
            await fetch(`/api/program/clear`, { method: 'DELETE' })
            fetchProgram()
        }
    }

    const handleUpdatePoints = async (points: any[]) => {
        await contextHandleUpdatePoints(points)
        fetchProgram()
    }

    const startEditing = (p: any) => {
        setEditingId(p.id)
        setEditValues({ x: p.x.toString(), y: p.y.toString() })
    }

    const saveEdit = () => {
        if (editingId === null) return
        const x = parseFloat(editValues.x)
        const y = parseFloat(editValues.y)
        if (isNaN(x) || isNaN(y)) return alert("Invalid coordinates")
        const newPoints = program.points.map((p: any) => (p.id === editingId ? { ...p, x, y } : p))
        handleUpdatePoints(newPoints)
        setEditingId(null)
    }

    const deletePoint = (id: number) => {
        const newPoints = program.points.filter((p: any) => p.id !== id)
        handleUpdatePoints(newPoints)
    }

    const onDragStart = (e: React.DragEvent, index: number) => {
        setDraggedIdx(index)
        e.dataTransfer.effectAllowed = "move"
    }

    const onDrop = (e: React.DragEvent, index: number) => {
        e.preventDefault()
        if (draggedIdx === null) return
        const items = [...program.points]
        const [movedItem] = items.splice(draggedIdx, 1)
        items.splice(index, 0, movedItem)
        handleUpdatePoints(items)
        setDraggedIdx(null)
    }

    return (
        <div className="flex-1 overflow-y-auto min-h-0 flex flex-col gap-4">
            {/* Program Management */}
            <div className="bg-zinc-900 rounded-2xl p-4 border border-zinc-800 space-y-3 shadow-xl shadow-black/10">
                <div className="flex items-center justify-between">
                    <div>
                        <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">Program</div>
                        <h3 className="font-bold text-zinc-200">Program Management</h3>
                    </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                    <input
                        value={programName} onChange={(e) => setProgramName(e.target.value)}
                        placeholder="Program Name"
                        className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2.5 text-xs focus:outline-none focus:border-blue-500 transition-colors"
                    />
                    <button onClick={handleSave} className="bg-blue-600 hover:bg-blue-500 px-3 py-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1 text-white shadow-lg shadow-blue-950/30 transition-colors"><Save size={14} /> Save</button>
                </div>

                {progList.length > 0 && (
                    <div className="space-y-1 max-h-48 overflow-y-auto border-t border-zinc-800 pt-3">
                        <h4 className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-1">Saved Programs</h4>
                        {progList.map((p: any) => (
                            <div key={p.name} className="flex justify-between items-center text-xs px-2.5 py-2.5 hover:bg-zinc-950 rounded-lg border border-transparent hover:border-zinc-800 transition group/item">
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
            <div className="bg-zinc-900 rounded-2xl p-4 border border-zinc-800 space-y-4 shadow-xl shadow-black/10">
                <div>
                    <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">Alignment</div>
                    <h3 className="font-bold flex items-center gap-2 text-zinc-300 mt-1"><MapPin size={16} /> Alignment Refs</h3>
                </div>
                <div className="grid grid-cols-3 gap-2">
                    {[1, 2, 3].map(i => {
                        const recorded = program.refs.find((r: any) => r.id === i)
                        return (
                            <button key={i} onClick={() => handleRecordRef(i)}
                                className={cn("flex-1 py-3 rounded-lg border text-sm font-medium transition relative overflow-hidden",
                                    recorded ? "bg-emerald-900/20 border-emerald-800 text-emerald-400" : "bg-zinc-950 border-zinc-800 text-zinc-500 hover:border-zinc-700")}>
                                Ref {i}
                                {recorded && <div className="text-[9px] mt-1 font-mono">{recorded.x},{recorded.y}</div>}
                            </button>
                        )
                    })}
                </div>
            </div>

            {/* Points List */}
            <div className="bg-zinc-900 rounded-2xl p-4 border border-zinc-800 space-y-4 flex-1 flex flex-col min-h-0 shadow-xl shadow-black/10">
                <div className="flex justify-between items-center">
                    <div>
                        <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">Inspection Path</div>
                        <h3 className="font-bold flex items-center gap-2 text-zinc-300 mt-1"><ListIcon size={16} /> Points ({program.points.length})</h3>
                    </div>
                    <button onClick={handleClear} className="text-red-500 p-2 hover:bg-red-900/20 rounded-lg transition-colors"><Trash2 size={16} /></button>
                </div>

                <div className="flex-1 bg-zinc-950 rounded-xl border border-zinc-800 overflow-y-auto p-2 space-y-1">
                    {program.points.length === 0 && <div className="text-zinc-600 text-center py-4 text-xs">No points recorded</div>}
                    {program.points.map((p: any, index: number) => (
                        <div
                            key={p.id}
                            draggable={editingId === null}
                            onDragStart={(e) => onDragStart(e, index)}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => onDrop(e, index)}
                            className={cn("group flex items-center gap-2 px-2.5 py-2 rounded-lg transition border border-transparent",
                                draggedIdx === index ? "opacity-30 border-blue-500" : "hover:bg-zinc-900 hover:border-zinc-800",
                                editingId === p.id ? "bg-zinc-900 border-blue-900/50" : "bg-zinc-900/30"
                            )}>
                            <GripVertical size={12} className="text-zinc-700 cursor-grab active:cursor-grabbing flex-shrink-0" />
                            <span className="text-[10px] text-zinc-500 w-6 font-mono">#{index + 1}</span>
                            {editingId === p.id ? (
                                <div className="flex flex-1 flex-wrap items-center gap-2">
                                    <div className="flex items-center gap-1">
                                        <span className="text-[10px] text-zinc-600">X</span>
                                        <input value={editValues.x} onChange={e => setEditValues(prev => ({ ...prev, x: e.target.value }))} className="w-12 bg-black border border-zinc-700 rounded px-1 text-xs font-mono outline-none focus:border-blue-500" />
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <span className="text-[10px] text-zinc-600">Y</span>
                                        <input value={editValues.y} onChange={e => setEditValues(prev => ({ ...prev, y: e.target.value }))} className="w-12 bg-black border border-zinc-700 rounded px-1 text-xs font-mono outline-none focus:border-blue-500" />
                                    </div>
                                    <button onClick={saveEdit} className="text-emerald-500 hover:bg-emerald-900/20 p-1 rounded"><Check size={14} /></button>
                                    <button onClick={() => setEditingId(null)} className="text-zinc-500 hover:bg-zinc-800 p-1 rounded"><X size={14} /></button>
                                </div>
                            ) : (
                                <>
                                    <div className="flex-1 font-mono text-xs text-zinc-300">{p.x.toFixed(2)}, {p.y.toFixed(2)}</div>
                                    <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => moveToAbsolute(p.x, p.y)} title="Move Camera" className="p-1.5 rounded text-zinc-500 hover:text-blue-400 hover:bg-blue-900/20"><Eye size={14} /></button>
                                        <button onClick={() => startEditing(p)} title="Edit" className="p-1.5 rounded text-zinc-500 hover:text-yellow-400 hover:bg-yellow-900/20"><Edit2 size={14} /></button>
                                        <button onClick={() => deletePoint(p.id)} title="Delete" className="p-1.5 rounded text-zinc-500 hover:text-red-400 hover:bg-red-900/20"><Trash2 size={14} /></button>
                                    </div>
                                </>
                            )}
                        </div>
                    ))}
                </div>
                <button onClick={handleRecordPoint} className="w-full py-3 bg-blue-600 hover:bg-blue-500 rounded-lg font-bold transition flex items-center justify-center gap-2 text-white shadow-lg shadow-blue-900/20 flex-shrink-0">
                    <Target size={18} /> Record Point
                </button>
            </div>
        </div>
    )
})
