import { useEffect, useMemo, useState } from 'react';
import { Activity, Camera, HardDrive, RefreshCw, Server, Terminal, Wifi } from 'lucide-react';

type SyncCounts = {
    added: number;
    skipped: number;
    updated: number;
    failed: number;
};

type SyncItem = {
    source: string;
    run_id?: string | null;
    status: 'added' | 'skipped' | 'updated' | 'failed';
    detail?: string;
};

type EdgeSnapshot = {
    synced_at?: string;
    counts?: SyncCounts;
    items?: SyncItem[];
    diagnostics?: Record<string, any>;
};

type EdgeDevice = {
    device_id: string;
    name: string;
    host: string;
    port: number;
    latest?: EdgeSnapshot;
};

type Notice = { type: 'ok' | 'error'; text: string };

const emptyCounts: SyncCounts = { added: 0, skipped: 0, updated: 0, failed: 0 };

async function parseResponse(res: Response) {
    const text = await res.text();
    try {
        return text ? JSON.parse(text) : {};
    } catch {
        return { detail: text || res.statusText };
    }
}

export function EdgeSyncPanel({ onSynced }: { onSynced?: () => void }) {
    const [devices, setDevices] = useState<EdgeDevice[]>([]);
    const [deviceId, setDeviceId] = useState('');
    const [snapshot, setSnapshot] = useState<EdgeSnapshot>({});
    const [loading, setLoading] = useState(true);
    const [testing, setTesting] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [notice, setNotice] = useState<Notice | null>(null);

    const selected = useMemo(
        () => devices.find(device => device.device_id === deviceId),
        [devices, deviceId],
    );

    const loadDevices = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/edges');
            const data = await parseResponse(res);
            if (!res.ok) throw new Error(data.detail || '讀取 Edge 設定失敗');
            const nextDevices = Array.isArray(data) ? data : [];
            setDevices(nextDevices);
            const nextId = deviceId || nextDevices[0]?.device_id || '';
            setDeviceId(nextId);
            setSnapshot(nextDevices.find((item: EdgeDevice) => item.device_id === nextId)?.latest || {});
        } catch (error) {
            setNotice({ type: 'error', text: error instanceof Error ? error.message : '讀取 Edge 設定失敗' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadDevices();
    }, []);

    useEffect(() => {
        if (selected) setSnapshot(selected.latest || {});
    }, [selected]);

    const testConnection = async () => {
        if (!deviceId) return;
        setTesting(true);
        setNotice(null);
        try {
            const res = await fetch(`/api/edges/${encodeURIComponent(deviceId)}/test`, { method: 'POST' });
            const data = await parseResponse(res);
            if (!res.ok) throw new Error(data.detail || 'Edge 連線失敗');
            setNotice({ type: 'ok', text: 'Edge SSH 與 Backend 連線正常。' });
        } catch (error) {
            setNotice({ type: 'error', text: error instanceof Error ? error.message : 'Edge 連線失敗' });
        } finally {
            setTesting(false);
        }
    };

    const syncEdge = async () => {
        if (!deviceId) return;
        setSyncing(true);
        setNotice(null);
        try {
            const res = await fetch(`/api/edges/${encodeURIComponent(deviceId)}/sync`, { method: 'POST' });
            const data = await parseResponse(res);
            if (!res.ok) throw new Error(data.detail || 'Edge 同步失敗');
            setSnapshot(data);
            setNotice({
                type: data.counts?.failed ? 'error' : 'ok',
                text: `同步完成：新增 ${data.counts?.added || 0}、跳過 ${data.counts?.skipped || 0}、更新 ${data.counts?.updated || 0}、失敗 ${data.counts?.failed || 0}`,
            });
            onSynced?.();
        } catch (error) {
            setNotice({ type: 'error', text: error instanceof Error ? error.message : 'Edge 同步失敗' });
        } finally {
            setSyncing(false);
        }
    };

    if (loading) {
        return (
            <section className="rounded-lg border border-slate-800 bg-slate-900 p-5 text-sm text-slate-400">
                <RefreshCw size={16} className="mr-2 inline animate-spin" />
                讀取 Edge 裝置設定…
            </section>
        );
    }

    if (!devices.length) {
        return (
            <section className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-5">
                <h3 className="font-semibold text-amber-200">尚未設定 Edge 裝置</h3>
                <p className="mt-2 text-sm text-amber-100/70">
                    請將 edge_devices.example.json 複製為 training-host/config/edge_devices.json，填入本機 SSH 設定後重新整理。
                </p>
            </section>
        );
    }

    const diagnostics = snapshot.diagnostics || {};
    const counts = snapshot.counts || emptyCounts;
    const failedItems = (snapshot.items || []).filter(item => item.status === 'failed');
    const health = diagnostics.health?.status || '—';
    const camera = diagnostics.camera?.available ?? diagnostics.camera?.opened ?? diagnostics.camera?.status ?? '—';
    const modelCount = Array.isArray(diagnostics.models?.models) ? diagnostics.models.models.length : 0;

    return (
        <section className="space-y-4 rounded-lg border border-blue-500/30 bg-slate-900 p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                    <h3 className="flex items-center gap-2 text-lg font-semibold text-white">
                        <Wifi size={18} className="text-blue-400" />
                        Edge SSH 同步
                    </h3>
                    <p className="mt-1 text-sm text-slate-400">唯讀同步 Capture、檢測歷史與裝置診斷資料，不會刪除 Edge 原始檔案。</p>
                </div>
                <div className="flex flex-wrap items-end gap-2">
                    {devices.length > 1 && (
                        <label className="block">
                            <span className="mb-1 block text-xs text-slate-500">Edge 裝置</span>
                            <select
                                value={deviceId}
                                onChange={event => setDeviceId(event.target.value)}
                                className="h-10 rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
                            >
                                {devices.map(device => <option key={device.device_id} value={device.device_id}>{device.name}</option>)}
                            </select>
                        </label>
                    )}
                    <button
                        onClick={testConnection}
                        disabled={testing || syncing}
                        className="h-10 rounded-md border border-slate-700 px-3 text-sm font-semibold text-slate-200 hover:bg-slate-800 disabled:opacity-50"
                    >
                        {testing ? '測試中…' : '測試連線'}
                    </button>
                    <button
                        onClick={syncEdge}
                        disabled={testing || syncing}
                        className="inline-flex h-10 items-center gap-2 rounded-md bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
                    >
                        <RefreshCw size={15} className={syncing ? 'animate-spin' : ''} />
                        {syncing ? '同步中…' : '從 Edge 同步'}
                    </button>
                </div>
            </div>

            <div className="text-xs text-slate-500">
                {selected?.name} · {selected?.host}:{selected?.port}
                {snapshot.synced_at && ` · 最近同步 ${new Date(snapshot.synced_at).toLocaleString('zh-TW', { hour12: false })}`}
            </div>

            {notice && (
                <div className={`rounded-md border px-3 py-2 text-sm ${notice.type === 'ok' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200' : 'border-red-500/30 bg-red-500/10 text-red-200'}`}>
                    {notice.text}
                </div>
            )}

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <StatusCard icon={Server} label="Backend" value={String(health)} />
                <StatusCard icon={Camera} label="相機" value={String(camera)} />
                <StatusCard icon={HardDrive} label="磁碟" value={typeof diagnostics.disk === 'string' ? diagnostics.disk : '—'} />
                <StatusCard icon={Activity} label="模型數" value={String(modelCount)} />
            </div>

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <CountCard label="新增" value={counts.added} tone="text-emerald-300" />
                <CountCard label="跳過" value={counts.skipped} tone="text-slate-200" />
                <CountCard label="更新" value={counts.updated} tone="text-blue-300" />
                <CountCard label="失敗" value={counts.failed} tone="text-red-300" />
            </div>

            {failedItems.length > 0 && (
                <div className="rounded-md border border-red-500/20 bg-red-500/5 p-3 text-sm text-red-200">
                    {failedItems.map(item => (
                        <div key={`${item.source}-${item.run_id || ''}`}>{item.source}：{item.detail || '同步失敗'}</div>
                    ))}
                </div>
            )}

            <details className="rounded-md border border-slate-800 bg-slate-950 p-3">
                <summary className="cursor-pointer text-sm font-semibold text-slate-300">
                    <Terminal size={15} className="mr-2 inline" />
                    最近服務日誌
                </summary>
                <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap text-xs leading-5 text-slate-400">
                    {typeof diagnostics.journal === 'string' ? diagnostics.journal : '尚無日誌快照。'}
                </pre>
            </details>
        </section>
    );
}

function StatusCard({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
    return (
        <div className="min-w-0 rounded-md border border-slate-800 bg-slate-950 p-3">
            <div className="flex items-center gap-2 text-xs text-slate-500"><Icon size={14} />{label}</div>
            <div className="mt-2 truncate text-sm font-semibold text-slate-100" title={value}>{value}</div>
        </div>
    );
}

function CountCard({ label, value, tone }: { label: string; value: number; tone: string }) {
    return (
        <div className="rounded-md border border-slate-800 bg-slate-950 p-3">
            <div className="text-xs text-slate-500">{label}</div>
            <div className={`mt-1 font-mono text-2xl font-semibold ${tone}`}>{value}</div>
        </div>
    );
}
