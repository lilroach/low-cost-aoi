import { useState } from 'react';
import { CheckCircle2, ExternalLink, RefreshCw, Tag, UploadCloud, XCircle } from 'lucide-react';

type ImportResult = {
    dataset_id: string;
    dataset_path: string;
    image_count: number;
    label_count: number;
    missing_label_count: number;
    classes: string[];
};

export function LabelingTool() {
    const [datasetId, setDatasetId] = useState('pcb-defects');
    const [archive, setArchive] = useState<File | null>(null);
    const [overwrite, setOverwrite] = useState(false);
    const [importing, setImporting] = useState(false);
    const [message, setMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);
    const [result, setResult] = useState<ImportResult | null>(null);

    const importYoloDataset = async () => {
        if (!archive || !datasetId.trim()) return;

        setImporting(true);
        setMessage(null);
        setResult(null);

        try {
            const form = new FormData();
            form.append('dataset_id', datasetId.trim());
            form.append('archive', archive, archive.name);
            form.append('overwrite', String(overwrite));
            const res = await fetch('/api/datasets/import-yolo', { method: 'POST', body: form });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.detail || '匯入失敗');
            setResult(data);
            setMessage({ type: 'ok', text: `已建立訓練資料集：${data.dataset_id}` });
            setArchive(null);
        } catch (error) {
            setMessage({ type: 'error', text: error instanceof Error ? error.message : '匯入失敗' });
        } finally {
            setImporting(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                    <Tag className="text-blue-400" />
                    資料標註（Label Studio）
                </h2>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 hover:border-blue-500 transition-colors">
                <div className="flex flex-col md:flex-row gap-8 items-start">
                    <div className="flex-1">
                        <h3 className="text-2xl font-semibold text-white mb-4">已整合 Label Studio</h3>
                        <p className="text-slate-400 mb-6 text-lg leading-relaxed">
                            請使用 Label Studio 標註 PCB 缺陷位置。完成後匯出 YOLO 格式，整理成可訓練的資料集。
                        </p>

                        <div className="grid grid-cols-2 gap-4 mb-8 max-w-md">
                            <div className="p-4 bg-slate-950 rounded border border-slate-800">
                                <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">帳號</p>
                                <p className="font-mono text-blue-300">admin@aoi.com</p>
                            </div>
                            <div className="p-4 bg-slate-950 rounded border border-slate-800">
                                <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">密碼</p>
                                <p className="font-mono text-blue-300">password123</p>
                            </div>
                        </div>

                        <a
                            href="http://localhost:8080"
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
                        >
                            <ExternalLink size={20} />
                            開啟 Label Studio
                        </a>
                    </div>

                    <div className="w-full md:w-1/3 bg-slate-950 p-6 rounded-lg border border-slate-800 text-sm text-slate-400">
                        <h4 className="text-white font-medium mb-3">快速操作步驟：</h4>
                        <ol className="list-decimal pl-4 space-y-2">
                            <li>開啟 Label Studio 並登入。</li>
                            <li>建立新專案，例如「PCB Defects」。</li>
                            <li>在 Import 選擇 <strong>Cloud Storage</strong>，再按 <strong>Add Source</strong>。</li>
                            <li>選擇 <strong>Local files</strong>。</li>
                            <li>Absolute local path 設定為：<code className="text-yellow-500">/label-studio/files</code></li>
                            <li>啟用 Treat every bucket object as a source file。</li>
                            <li>按 Check Connection，再按 Save。</li>
                            <li>按 Sync 載入圖片。</li>
                        </ol>
                    </div>
                </div>
            </div>

            <section className="rounded-xl border border-slate-800 bg-slate-900 p-6">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                        <h3 className="flex items-center gap-2 text-lg font-semibold text-white">
                            <UploadCloud size={20} className="text-blue-400" />
                            匯入 Label Studio YOLO ZIP
                        </h3>
                        <p className="mt-1 text-sm text-slate-400">
                            會自動整理成 images、labels、classes.txt 與 data.yaml，匯入後可直接到「訓練+驗證」選用。
                        </p>
                    </div>
                    {message && (
                        <div className={`inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-semibold ${message.type === 'ok'
                            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                            : 'border-red-500/30 bg-red-500/10 text-red-300'
                            }`}>
                            {message.type === 'ok' ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                            {message.text}
                        </div>
                    )}
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-[280px_minmax(0,1fr)_auto] md:items-end">
                    <label className="block">
                        <span className="mb-1 block text-sm text-slate-400">資料集 ID</span>
                        <input
                            value={datasetId}
                            onChange={event => setDatasetId(event.target.value)}
                            className="h-11 w-full rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-white outline-none focus:border-blue-500"
                            placeholder="pcb-defects"
                        />
                    </label>
                    <label className="block">
                        <span className="mb-1 block text-sm text-slate-400">YOLO ZIP</span>
                        <input
                            type="file"
                            accept=".zip,application/zip"
                            onChange={event => setArchive(event.target.files?.[0] ?? null)}
                            className="block w-full rounded-md border border-slate-700 bg-slate-950 text-sm text-slate-300 file:mr-4 file:border-0 file:bg-slate-800 file:px-4 file:py-3 file:text-sm file:font-bold file:text-slate-200"
                        />
                    </label>
                    <button
                        onClick={importYoloDataset}
                        disabled={!archive || !datasetId.trim() || importing}
                        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-blue-600 px-4 text-sm font-bold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {importing ? <RefreshCw size={16} className="animate-spin" /> : <UploadCloud size={16} />}
                        {importing ? '匯入中' : '匯入資料集'}
                    </button>
                </div>

                <label className="mt-3 inline-flex items-center gap-2 text-sm text-slate-400">
                    <input
                        type="checkbox"
                        checked={overwrite}
                        onChange={event => setOverwrite(event.target.checked)}
                        className="h-4 w-4 rounded border-slate-700 bg-slate-950"
                    />
                    覆蓋同名資料集
                </label>

                {result && (
                    <div className="mt-5 grid gap-3 md:grid-cols-4">
                        <ImportStat label="圖片" value={result.image_count} />
                        <ImportStat label="標註檔" value={result.label_count} />
                        <ImportStat label="無 label 圖片" value={result.missing_label_count} />
                        <ImportStat label="類別" value={result.classes.join(', ') || '-'} />
                    </div>
                )}
            </section>
        </div>
    );
}

function ImportStat({ label, value }: { label: string; value: string | number }) {
    return (
        <div className="rounded-md border border-slate-800 bg-slate-950 px-3 py-3">
            <div className="text-xs text-slate-500">{label}</div>
            <div className="mt-1 truncate text-sm font-semibold text-white" title={String(value)}>{value}</div>
        </div>
    );
}
