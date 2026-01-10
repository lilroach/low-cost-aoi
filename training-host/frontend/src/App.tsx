import { useEffect, useState } from 'react'
import { DatasetManager } from './features/DatasetManager'
import { LabelingTool } from './features/LabelingTool'
import { TrainingMonitor } from './features/TrainingMonitor'
import { Database, Server, Image, Tag, BarChart } from 'lucide-react'

type Tab = 'datasets' | 'labeling' | 'training';

function App() {
    const [status, setStatus] = useState<any>(null)
    const [currentTab, setCurrentTab] = useState<Tab>('datasets')

    useEffect(() => {
        fetch('/api/health')
            .then(res => res.json())
            .then(setStatus)
            .catch(() => setStatus({ status: 'offline' }))
    }, [])

    return (
        <div className="min-h-screen bg-slate-950 text-slate-200 font-sans">
            {/* Navbar */}
            <nav className="border-b border-slate-800 bg-slate-900/50 backdrop-blur sticky top-0 z-50">
                <div className="container mx-auto px-4 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-8">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center font-bold text-white">
                                A
                            </div>
                            <span className="font-semibold text-lg">AOI Trainer</span>
                        </div>

                        {/* Navigation Tabs */}
                        <div className="flex items-center gap-1">
                            <NavButton
                                active={currentTab === 'datasets'}
                                onClick={() => setCurrentTab('datasets')}
                                icon={Image}
                                label="Datasets"
                            />
                            <NavButton
                                active={currentTab === 'labeling'}
                                onClick={() => setCurrentTab('labeling')}
                                icon={Tag}
                                label="Labeling"
                            />
                            <NavButton
                                active={currentTab === 'training'}
                                onClick={() => setCurrentTab('training')}
                                icon={BarChart}
                                label="Training"
                            />
                        </div>
                    </div>

                    <div className="flex items-center gap-4 text-sm">
                        <StatusBadge label="API" status={status?.status === 'online'} icon={Server} />
                        <StatusBadge label="Redis" status={status?.redis === 'ok'} icon={Database} />
                    </div>
                </div>
            </nav>

            {/* Main Content */}
            <main className="container mx-auto px-4 py-8">
                <div className="max-w-6xl mx-auto">
                    {currentTab === 'datasets' && (
                        <DatasetManager onNavigateToLabeling={() => setCurrentTab('labeling')} />
                    )}
                    {currentTab === 'labeling' && <LabelingTool />}
                    {currentTab === 'training' && <TrainingMonitor />}
                </div>
            </main>
        </div>
    )
}

function NavButton({ active, onClick, icon: Icon, label }: { active: boolean, onClick: () => void, icon: any, label: string }) {
    return (
        <button
            onClick={onClick}
            className={`flex items-center gap-2 px-4 py-2 rounded-md transition-colors text-sm font-medium ${active
                ? "bg-slate-800 text-white"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                }`}
        >
            <Icon size={16} />
            {label}
        </button>
    )
}

function StatusBadge({ label, status, icon: Icon }: { label: string, status: boolean, icon: any }) {
    return (
        <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full border ${status
            ? "bg-green-500/10 border-green-500/20 text-green-400"
            : "bg-red-500/10 border-red-500/20 text-red-400"
            }`}>
            <Icon size={14} />
            <span>{label}</span>
            <span className={`w-1.5 h-1.5 rounded-full ${status ? "bg-green-400" : "bg-red-400"}`} />
        </div>
    )
}

export default App
