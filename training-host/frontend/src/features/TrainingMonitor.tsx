import { useState, useEffect, useRef } from 'react';
import { Play, Square, Activity, Terminal } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

export function TrainingMonitor() {
    const [status, setStatus] = useState<any>({ is_running: false, progress: 0, metrics: { loss: [], map50: [] } });
    const [logs, setLogs] = useState<string[]>([]);
    const [config, setConfig] = useState({ model_type: 'yolov8n.pt', epochs: 50 });
    const wsRef = useRef<WebSocket | null>(null);
    const logEndRef = useRef<HTMLDivElement>(null);

    // Fetch initial status
    useEffect(() => {
        fetch('/api/training/status').then(res => res.json()).then(setStatus);

        // Connect WebSocket
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const ws = new WebSocket(`${protocol}//${window.location.host}/api/training/ws`);

        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.type === 'log') {
                setLogs(prev => [...prev, `[${data.timestamp}] ${data.message}`].slice(-100)); // Keep last 100 logs
            } else if (data.type === 'metrics') {
                // Handle pure metrics update if separated
            } else {
                // Info/Start/Stop
                setLogs(prev => [...prev, `[${data.timestamp}] ${data.type.toUpperCase()}: ${data.message}`]);
            }

            if (data.metrics) {
                setStatus((prev: any) => ({
                    ...prev,
                    is_running: true,
                    progress: data.progress,
                    current_epoch: data.epoch,
                    metrics: data.metrics
                }));
            }
        };

        wsRef.current = ws;

        return () => {
            ws.close();
        };
    }, []);

    // Auto-scroll logs
    useEffect(() => {
        logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [logs]);

    const handleStart = async () => {
        try {
            const res = await fetch('/api/training/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(config)
            });
            if (res.ok) {
                setLogs(prev => [...prev, ">>> Command sent: START TRAINING"]);
                setStatus((prev: any) => ({ ...prev, is_running: true }));
            }
        } catch (err) {
            console.error(err);
        }
    };

    const handleStop = async () => {
        try {
            await fetch('/api/training/stop', { method: 'POST' });
            setLogs(prev => [...prev, ">>> Command sent: STOP TRAINING"]);
        } catch (err) {
            console.error(err);
        }
    };

    // Prepare chart data
    const chartData = status.metrics?.loss?.map((loss: number, idx: number) => ({
        epoch: idx + 1,
        loss: loss,
        map50: status.metrics.map50[idx]
    })) || [];

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Panel: Config & Status */}
            <div className="space-y-6">
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                    <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                        <Activity className="text-blue-400" />
                        Configuration
                    </h3>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm text-slate-400 mb-1">Model Architecture</label>
                            <select
                                className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white"
                                value={config.model_type}
                                onChange={e => setConfig({ ...config, model_type: e.target.value })}
                                disabled={status.is_running}
                            >
                                <option value="yolov8n.pt">YOLOv8 Nano (Fastest)</option>
                                <option value="yolov8s.pt">YOLOv8 Small (Balanced)</option>
                                <option value="yolov8m.pt">YOLOv8 Medium (Accurate)</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm text-slate-400 mb-1">Epochs</label>
                            <input
                                type="number"
                                className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white"
                                value={config.epochs}
                                onChange={e => setConfig({ ...config, epochs: parseInt(e.target.value) })}
                                disabled={status.is_running}
                            />
                        </div>
                    </div>

                    <div className="mt-8 flex gap-3">
                        {!status.is_running ? (
                            <button
                                onClick={handleStart}
                                className="flex-1 bg-green-600 hover:bg-green-500 text-white py-3 rounded-lg font-bold flex items-center justify-center gap-2 transition-colors"
                            >
                                <Play size={20} /> Start Training
                            </button>
                        ) : (
                            <button
                                onClick={handleStop}
                                className="flex-1 bg-red-600 hover:bg-red-500 text-white py-3 rounded-lg font-bold flex items-center justify-center gap-2 transition-colors"
                            >
                                <Square size={20} /> Stop Training
                            </button>
                        )}
                    </div>
                </div>

                {/* Progress Card */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                    <div className="flex justify-between items-end mb-2">
                        <span className="text-slate-400">Progress</span>
                        <span className="text-2xl font-mono text-white">{status.progress}%</span>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-4 overflow-hidden">
                        <div
                            className="bg-blue-500 h-full transition-all duration-300 striped-bar"
                            style={{ width: `${status.progress}%` }}
                        />
                    </div>
                    <div className="mt-2 text-right text-xs text-slate-500">
                        Epoch: {status.current_epoch || 0} / {config.epochs}
                    </div>
                </div>
            </div>

            {/* Right Panel: Charts & Logs */}
            <div className="lg:col-span-2 space-y-6">
                {/* Charts */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 h-[400px]">
                    <h3 className="text-lg font-semibold text-white mb-4">Real-time Metrics</h3>
                    <div className="w-full h-[320px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                <XAxis dataKey="epoch" stroke="#94a3b8" />
                                <YAxis stroke="#94a3b8" />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#fff' }}
                                />
                                <Legend />
                                <Line type="monotone" dataKey="loss" stroke="#ef4444" name="Box Loss" dot={false} />
                                <Line type="monotone" dataKey="map50" stroke="#3b82f6" name="mAP@50" dot={false} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Terminal Log */}
                <div className="bg-black border border-slate-800 rounded-xl p-4 font-mono text-sm h-[200px] overflow-y-auto flex flex-col">
                    <div className="flex items-center gap-2 text-slate-500 mb-2 sticky top-0 bg-black/90 pb-2 border-b border-slate-900">
                        <Terminal size={14} /> Training Log Output
                    </div>
                    <div className="flex-1 space-y-1">
                        {logs.length === 0 && <span className="text-slate-700 italic">Waiting for logs...</span>}
                        {logs.map((log, i) => (
                            <div key={i} className="text-slate-300 whitespace-pre-wrap">{log}</div>
                        ))}
                        <div ref={logEndRef} />
                    </div>
                </div>
            </div>

            <style>{`
                .striped-bar {
                    background-image: linear-gradient(45deg,rgba(255,255,255,.15) 25%,transparent 25%,transparent 50%,rgba(255,255,255,.15) 50%,rgba(255,255,255,.15) 75%,transparent 75%,transparent);
                    background-size: 1rem 1rem;
                }
            `}</style>
        </div>
    );
}
