import { useState, useEffect } from 'react'
import { Camera, Check, Eye, X, Hash, Package } from 'lucide-react'
import { cn } from '../../lib/utils'
import { useApp } from '../../context/AppContext'

export default function CaptureView() {
    const { partNo, setPartNo, batchNo, setBatchNo } = useApp()
    const [isSnapping, setIsSnapping] = useState(false)
    const [snapCount, setSnapCount] = useState(0)
    const [showSuccess, setShowSuccess] = useState(false)
    const [showReview, setShowReview] = useState(false)
    const [capturedImages, setCapturedImages] = useState<any[]>([])
    const [selectedImg, setSelectedImg] = useState<string | null>(null)

    const fetchCount = async () => {
        try {
            const res = await fetch('/api/capture/count')
            const data = await res.json()
            setSnapCount(data.count)
        } catch (e) { }
    }

    const fetchImages = async () => {
        try {
            const res = await fetch('/api/capture/list')
            const data = await res.json()
            setCapturedImages(data.images)
        } catch (e) { }
    }

    useEffect(() => {
        fetchCount()
    }, [])

    const handleSnap = async () => {
        if (isSnapping) return
        setIsSnapping(true)
        try {
            const url = `/api/capture/snap?part_no=${encodeURIComponent(partNo || 'NA')}&batch_no=${encodeURIComponent(batchNo || 'NA')}`
            const res = await fetch(url, { method: 'POST' })
            if (res.ok) {
                setShowSuccess(true)
                setSnapCount(prev => prev + 1)
                fetchImages() // Refresh list if sidebar or modal is open
                setTimeout(() => setShowSuccess(false), 1500)
            }
        } catch (e) {
            alert("Capture failed")
        } finally {
            setIsSnapping(false)
        }
    }

    const openReview = () => {
        fetchImages()
        setShowReview(true)
    }

    return (
        <div className="flex flex-col h-full gap-4 overflow-hidden">
            {/* Metadata Inputs Row */}
            <div className="flex flex-col lg:flex-row gap-3 bg-zinc-900/70 p-4 rounded-2xl border border-zinc-800 shadow-xl shadow-black/10">
                <div className="flex-1 flex items-center gap-3 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 group focus-within:border-blue-500/60 transition-colors">
                    <Package size={16} className="text-zinc-500" />
                    <div className="flex flex-col flex-1">
                        <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Part Number</label>
                        <input
                            value={partNo}
                            onChange={(e) => setPartNo(e.target.value)}
                            placeholder="e.g. PCB-A-V1"
                            className="bg-transparent border-none outline-none text-sm text-zinc-200 placeholder:text-zinc-700 w-full"
                        />
                    </div>
                </div>
                <div className="flex-1 flex items-center gap-3 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 group focus-within:border-blue-500/60 transition-colors">
                    <Hash size={16} className="text-zinc-500" />
                    <div className="flex flex-col flex-1">
                        <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Batch Number</label>
                        <input
                            value={batchNo}
                            onChange={(e) => setBatchNo(e.target.value)}
                            placeholder="e.g. 2024-Q1"
                            className="bg-transparent border-none outline-none text-sm text-zinc-200 placeholder:text-zinc-700 w-full"
                        />
                    </div>
                </div>
                <button
                    onClick={openReview}
                    className="min-h-[58px] flex flex-row lg:flex-col items-center justify-center px-6 bg-zinc-800 hover:bg-zinc-700 rounded-xl border border-zinc-700 transition-colors gap-2 lg:gap-1 group"
                >
                    <Eye size={18} className="text-zinc-400 group-hover:text-blue-400 transition-colors" />
                    <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-tighter">Review</span>
                </button>
            </div>

            {/* Main Content Area - Maximized Camera */}
            <div className="flex-1 relative min-h-[420px] bg-black rounded-2xl overflow-hidden border border-zinc-800 shadow-2xl shadow-black/40 flex items-center justify-center">
                {/*
                  Fix: Use object-contain and aspect-ratio based on image
                  We force 4:3 or 16:9 container, but ensure it doesn't overflow
                */}
                <div className="relative w-full h-full max-h-screen flex items-center justify-center bg-zinc-950">
                    <img
                        src="/api/camera/feed"
                        className="max-w-full max-h-full object-contain"
                        alt="Capture Feed"
                    />

                    {/* Snapshot Flash Overlay */}
                    {isSnapping && (
                        <div className="absolute inset-0 bg-white/20 animate-out fade-out duration-300 pointer-events-none z-50"></div>
                    )}
                </div>

                {/* Floating Info Overlay */}
                <div className="absolute top-4 left-4 sm:top-5 sm:left-5 flex max-w-[calc(100%-2rem)] flex-col gap-2 pointer-events-none">
                    <div className="bg-emerald-500 text-white text-[10px] font-bold px-3 py-1.5 rounded-full shadow-lg shadow-emerald-900/40 uppercase tracking-widest flex items-center gap-2">
                        <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></div>
                        YOLO Collection Mode
                    </div>
                    <div className="bg-black/70 backdrop-blur-md border border-white/10 text-white px-3 py-2 rounded-xl shadow-xl flex items-center gap-3">
                        <span className="text-xs text-zinc-400 font-medium font-mono text-[10px]">{partNo || 'NO_PART'} | {batchNo || 'NO_BATCH'}</span>
                        <div className="w-px h-3 bg-zinc-700"></div>
                        <span className="text-sm font-bold text-blue-400 font-mono">{snapCount}</span>
                    </div>
                </div>

                {/* SUCCESS BUBBLE */}
                {showSuccess && (
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-emerald-500/90 backdrop-blur text-white px-6 py-4 rounded-3xl shadow-2xl flex flex-col items-center gap-2 animate-in zoom-in spin-in-1 duration-300 z-50">
                        <Check size={32} strokeWidth={3} />
                        <span className="font-bold uppercase tracking-tighter">Saved!</span>
                    </div>
                )}

                {/* FLOATING SNAP BUBBLE */}
                <button
                    onClick={handleSnap}
                    disabled={isSnapping}
                    className={cn(
                        "absolute bottom-5 right-5 sm:bottom-8 sm:right-8 w-20 h-20 sm:w-24 sm:h-24 rounded-full flex items-center justify-center transition-all duration-300 shadow-2xl active:scale-95 group/btn overflow-hidden z-40",
                        isSnapping
                            ? "bg-zinc-800 scale-95 cursor-not-allowed opacity-50"
                            : "bg-blue-600 hover:bg-blue-500 hover:scale-110 active:bg-blue-700 ring-4 ring-blue-600/20"
                    )}
                >
                    <span className="absolute inset-0 bg-white/20 scale-0 group-hover/btn:scale-150 transition-transform duration-700 rounded-full origin-center"></span>
                    {isSnapping ? (
                        <div className="w-8 h-8 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
                    ) : (
                        <div className="relative flex flex-col items-center gap-0.5 text-white">
                            <Camera size={36} />
                            <span className="text-[10px] font-black uppercase tracking-widest">SNAP</span>
                        </div>
                    )}
                </button>
            </div>

            {/* REVIEW MODAL */}
            {showReview && (
                <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[100] flex items-center justify-center p-4 sm:p-8 animate-in fade-in duration-300">
                    <div className="bg-zinc-900 w-full max-w-6xl h-full max-h-[90vh] rounded-2xl border border-zinc-800 shadow-2xl flex flex-col overflow-hidden">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between gap-3 p-4 sm:p-5 border-b border-zinc-800 bg-zinc-950/40">
                            <div className="flex min-w-0 items-center gap-3">
                                <div className="p-2 bg-blue-500/10 rounded-lg text-blue-400">
                                    <Eye size={20} />
                                </div>
                                <div className="min-w-0">
                                    <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">Today's Captures</h2>
                                    <p className="text-xs text-zinc-500">Collected training data for YOLO pre-training</p>
                                </div>
                            </div>
                            <button onClick={() => setShowReview(false)} className="p-2 hover:bg-zinc-800 rounded-full text-zinc-500 hover:text-white transition-colors">
                                <X size={24} />
                            </button>
                        </div>

                        {/* Modal Body - Grid of images */}
                        <div className="flex-1 overflow-y-auto p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                            {capturedImages.length === 0 ? (
                                <div className="col-span-full h-full flex flex-col items-center justify-center text-zinc-600 gap-4 opacity-50">
                                    <Camera size={64} strokeWidth={1} />
                                    <span className="font-medium">No images captured today</span>
                                </div>
                            ) : (
                                capturedImages.map((img, idx) => (
                                    <div
                                        key={idx}
                                        className="group relative aspect-video bg-black rounded-lg overflow-hidden border border-zinc-800 cursor-pointer hover:border-blue-500/50 transition-all"
                                        onClick={() => setSelectedImg(img.url)}
                                    >
                                        <img src={img.url} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" alt={img.name} />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-3 flex flex-col justify-end">
                                            <p className="text-[10px] font-mono text-white truncate">{img.name}</p>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* FULLSCREEN IMAGE OVERLAY */}
            {selectedImg && (
                <div className="fixed inset-0 bg-black/95 z-[110] flex items-center justify-center p-12 transition-all animate-in zoom-in duration-200" onClick={() => setSelectedImg(null)}>
                    <img src={selectedImg} className="max-w-full max-h-full object-contain shadow-2xl rounded-lg" alt="Fullscreen preview" />
                    <button className="absolute top-8 right-8 text-white/50 hover:text-white transition-colors bg-white/10 p-2 rounded-full">
                        <X size={32} />
                    </button>
                </div>
            )}
        </div>
    )
}
