import { useEffect, useMemo, useRef, useState } from 'react';
import { Activity, Archive, Box, CheckCircle2, ClipboardCheck, Cpu, Download, FolderOpen, PackageCheck, Play, RefreshCw, Settings2, ShieldCheck, Square, Terminal } from 'lucide-react';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

type DatasetSummary = {
    dataset_id: string;
    path: string;
    data_yaml: string;
    has_data_yaml: boolean;
    image_count: number;
    label_count: number;
    classes: string[];
};

type TrainingRun = {
    run_name: string;
    run_path: string;
    dataset_id?: string | null;
    best_model_path: string | null;
    has_best_model: boolean;
    updated_at: string;
};

type ModelBundle = {
    model_id: string;
    part_no?: string;
    version?: string;
    format?: string;
    has_weights: boolean;
    created_at?: string;
};

type ValidationModel = {
    model_ref: string;
    source: string;
    id: string;
    name: string;
    weights_path: string;
    part_no?: string;
    version?: string;
};

type ValidationReport = {
    report_id: string;
    report_path: string;
    status: 'passed' | 'failed';
    summary: {
        total: number;
        correct: number;
        pass_rate: number;
        ok_total: number;
        ok_correct: number;
        ok_accuracy: number | null;
        ng_total: number;
        ng_detected: number;
        ng_recall: number | null;
        false_pass: number;
        false_reject: number;
        missing_label_files: number;
    };
    class_stats: Record<string, { truth: number; detected: number; recall: number }>;
    examples: Array<{
        image: string;
        result: string;
        truth: string;
        prediction: string;
        truth_classes: string[];
        predicted_classes: string[];
    }>;
};

type TrainingStatus = {
    is_running: boolean;
    progress: number;
    current_epoch: number;
    total_epochs: number;
    metrics: { loss: number[]; map50: number[] };
    logs: string[];
    current_run?: {
        run_name: string;
        dataset_id: string;
        model_type: string;
        run_path: string;
        best_model_path: string;
        status: string;
    } | null;
};

const baseModels = ['yolo11n.pt', 'yolo11s.pt', 'yolo11m.pt'];

const statusLabels: Record<string, string> = {
    running: '訓練中',
    completed: '已完成',
    failed: '失敗',
};

type TrainingMonitorMode = 'training' | 'deployment';

export function TrainingMonitor({ mode = 'training' }: { mode?: TrainingMonitorMode }) {
    const [datasets, setDatasets] = useState<DatasetSummary[]>([]);
    const [validationDatasets, setValidationDatasets] = useState<DatasetSummary[]>([]);
    const [validationModels, setValidationModels] = useState<ValidationModel[]>([]);
    const [runs, setRuns] = useState<TrainingRun[]>([]);
    const [bundles, setBundles] = useState<ModelBundle[]>([]);
    const [validationReport, setValidationReport] = useState<ValidationReport | null>(null);
    const [validating, setValidating] = useState(false);
    const [status, setStatus] = useState<TrainingStatus>({
        is_running: false,
        progress: 0,
        current_epoch: 0,
        total_epochs: 0,
        metrics: { loss: [], map50: [] },
        logs: [],
        current_run: null,
    });
    const [config, setConfig] = useState({
        dataset_id: 'testv1',
        model_type: 'yolo11n.pt',
        epochs: 50,
        batch_size: 8,
        img_size: 640,
        run_name: 'testv1-yolo11-smoke',
    });
    const [bundleForm, setBundleForm] = useState({
        model_id: 'testv1-yolo11-smoke',
        part_no: 'testv1',
        version: 'smoke',
        confidence_threshold: 0.25,
        iou_threshold: 0.45,
    });
    const [validationForm, setValidationForm] = useState({
        model_ref: '',
        validation_dataset_id: '',
        confidence_threshold: 0.25,
        iou_threshold: 0.45,
        min_pass_rate: 0.9,
        min_ng_recall: 0.95,
    });
    const [selectedRun, setSelectedRun] = useState('');
    const [notice, setNotice] = useState('');
    const [deploymentLogs, setDeploymentLogs] = useState<string[]>([]);
    const logEndRef = useRef<HTMLDivElement>(null);
    const deploymentLogEndRef = useRef<HTMLDivElement>(null);

    const selectedDataset = datasets.find(dataset => dataset.dataset_id === config.dataset_id);
    const selectedRunData = runs.find(run => run.run_name === selectedRun);
    const selectedValidationDataset = validationDatasets.find(dataset => dataset.dataset_id === validationForm.validation_dataset_id);

    const chartData = useMemo(() => {
        return status.metrics?.loss?.map((loss, index) => ({
            epoch: index + 1,
            loss,
            map50: status.metrics.map50[index],
        })) || [];
    }, [status.metrics]);

    const refreshAll = async () => {
        const [datasetRes, validationDatasetRes, validationModelRes, statusRes, runRes, modelRes] = await Promise.all([
            fetch('/api/training/datasets'),
            fetch('/api/training/validation-datasets'),
            fetch('/api/training/validation-models'),
            fetch('/api/training/status'),
            fetch('/api/training/runs'),
            fetch('/api/training/models'),
        ]);

        if (datasetRes.ok) {
            const data = await datasetRes.json();
            setDatasets(data.datasets || []);
            if (data.datasets?.length && !data.datasets.some((dataset: DatasetSummary) => dataset.dataset_id === config.dataset_id)) {
                const first = data.datasets[0];
                setConfig(prev => ({
                    ...prev,
                    dataset_id: first.dataset_id,
                    run_name: `${first.dataset_id}-yolo11-smoke`,
                }));
                setBundleForm(prev => ({ ...prev, model_id: `${first.dataset_id}-yolo11-smoke`, part_no: first.dataset_id }));
            }
        }
        if (statusRes.ok) setStatus(await statusRes.json());
        if (validationDatasetRes.ok) {
            const data = await validationDatasetRes.json();
            setValidationDatasets(data.datasets || []);
            if (!validationForm.validation_dataset_id && data.datasets?.length) {
                setValidationForm(prev => ({ ...prev, validation_dataset_id: data.datasets[0].dataset_id }));
            }
        }
        if (validationModelRes.ok) {
            const data = await validationModelRes.json();
            setValidationModels(data.models || []);
            if (!validationForm.model_ref && data.models?.length) {
                setValidationForm(prev => ({ ...prev, model_ref: data.models[0].model_ref }));
            }
        }
        if (runRes.ok) {
            const data = await runRes.json();
            setRuns(data.runs || []);
            if (!selectedRun && data.runs?.length) setSelectedRun(data.runs[0].run_name);
        }
        if (modelRes.ok) {
            const data = await modelRes.json();
            setBundles(data.models || []);
        }
    };

    useEffect(() => {
        refreshAll().catch(console.error);

        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const ws = new WebSocket(`${protocol}//${window.location.host}/api/training/ws`);
        ws.onmessage = event => {
            const data = JSON.parse(event.data);
            setStatus(prev => ({
                ...prev,
                is_running: data.is_running ?? prev.is_running,
                progress: data.progress ?? prev.progress,
                current_epoch: data.current_epoch ?? prev.current_epoch,
                total_epochs: data.total_epochs ?? prev.total_epochs,
                metrics: data.metrics ?? prev.metrics,
                current_run: data.current_run ?? prev.current_run,
                logs: data.message ? [...prev.logs, `[${data.timestamp}] ${data.message}`] : prev.logs,
            }));
            if (['success', 'error', 'warning', 'status'].includes(data.type)) {
                refreshAll().catch(console.error);
            }
        };

        return () => ws.close();
    }, []);

    useEffect(() => {
        logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [status.logs]);

    useEffect(() => {
        deploymentLogEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [deploymentLogs]);

    const logDeployment = (message: string) => {
        const timestamp = new Date().toLocaleTimeString('zh-TW', { hour12: false });
        setDeploymentLogs(prev => [...prev, `[${timestamp}] ${message}`]);
    };

    const patchConfig = (patch: Partial<typeof config>) => {
        setConfig(prev => {
            const next = { ...prev, ...patch };
            if (patch.dataset_id) {
                next.run_name = `${patch.dataset_id}-yolo11-smoke`;
                setBundleForm(bundle => ({ ...bundle, model_id: next.run_name, part_no: patch.dataset_id || bundle.part_no }));
            }
            if (patch.run_name) {
                setBundleForm(bundle => ({ ...bundle, model_id: patch.run_name || bundle.model_id }));
            }
            return next;
        });
    };

    const startTraining = async () => {
        setNotice('');
        setStatus(prev => ({ ...prev, is_running: true, progress: 0, logs: [] }));
        const res = await fetch('/api/training/start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(config),
        });
        if (!res.ok) {
            const error = await res.json().catch(() => ({ detail: '啟動訓練失敗' }));
            setNotice(error.detail);
            setStatus(prev => ({ ...prev, is_running: false }));
            return;
        }
        setSelectedRun(config.run_name);
    };

    const stopTraining = async () => {
        await fetch('/api/training/stop', { method: 'POST' });
    };

    const packageBundle = async () => {
        if (!selectedRunData?.has_best_model) {
            setNotice('請先選擇已完成且包含 weights/best.pt 的訓練 run。');
            logDeployment('ERROR: 尚未選擇可部署的 best.pt run。');
            return;
        }
        setNotice('');
        const datasetId = selectedRunData.dataset_id || config.dataset_id;
        const payload = {
            run_name: selectedRun,
            dataset_id: datasetId,
            source_yolo_model: config.model_type,
            img_size: config.img_size,
            ...bundleForm,
        };
        logDeployment('========== 建立部署模型包 ==========');
        logDeployment('POST /api/training/package');
        logDeployment(JSON.stringify(payload, null, 2));
        const res = await fetch('/api/training/package', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            setNotice(data.detail || '部署模型包建立失敗');
            logDeployment(`ERROR: ${data.detail || '部署模型包建立失敗'}`);
            return;
        }
        setNotice(`部署模型包已建立：${data.bundle_path}`);
        logDeployment(`SUCCESS: 部署模型包已建立`);
        logDeployment(`model_id: ${data.model_id}`);
        logDeployment(`bundle_path: ${data.bundle_path}`);
        logDeployment('====================================');
        await refreshAll();
    };

    const validateModel = async () => {
        if (!validationForm.model_ref || !validationForm.validation_dataset_id) {
            setNotice('請先選擇模型與驗證資料集。');
            return;
        }
        setValidating(true);
        setNotice('模型驗證執行中，請稍候...');
        setValidationReport(null);
        try {
            const res = await fetch('/api/training/validate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(validationForm),
            });
            const data = await res.json().catch(() => ({}));
            setValidating(false);
            if (!res.ok) {
                setNotice(data.detail || '模型驗證失敗');
                return;
            }
            setValidationReport(data);
            setNotice(data.status === 'passed' ? '模型驗證通過。' : '模型驗證未通過，請查看漏判與誤殺。');
        } catch (error) {
            setValidating(false);
            setNotice('模型驗證失敗：無法連線到後端。');
            return;
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                        {mode === 'training' ? <Activity className="text-blue-400" /> : <PackageCheck className="text-blue-400" />}
                        {mode === 'training' ? '訓練+驗證' : '部署'}
                    </h2>
                    <p className="mt-1 text-sm text-slate-400">
                        {mode === 'training' ? '資料集 -> YOLO11 訓練 -> 模型驗證' : '選擇 best.pt -> 建立部署模型包 -> 下載部署'}
                    </p>
                </div>
                <button onClick={refreshAll} className="inline-flex items-center gap-2 rounded-md border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800">
                    <RefreshCw size={16} />
                    重新整理
                </button>
            </div>

            {notice && (
                <div className="rounded-md border border-blue-500/30 bg-blue-500/10 px-4 py-3 text-sm text-blue-100">
                    {notice}
                </div>
            )}

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
                <div className="space-y-6">
                    {mode === 'training' && <section className="rounded-lg border border-slate-800 bg-slate-900 p-5">
                        <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-white">
                            <Settings2 className="text-slate-300" size={20} />
                            訓練設定
                        </h3>

                        <div className="space-y-4">
                            <Field label="資料集">
                                <select
                                    value={config.dataset_id}
                                    onChange={event => patchConfig({ dataset_id: event.target.value })}
                                    disabled={status.is_running}
                                    className="control"
                                >
                                    {datasets.map(dataset => (
                                        <option key={dataset.dataset_id} value={dataset.dataset_id}>{dataset.dataset_id}</option>
                                    ))}
                                </select>
                            </Field>

                            {selectedDataset && (
                                <div className="rounded-md border border-slate-800 bg-slate-950 px-3 py-3 text-sm text-slate-300">
                                    <div className="flex items-center justify-between">
                                        <span>圖片數</span>
                                        <span className="font-mono text-white">{selectedDataset.image_count}</span>
                                    </div>
                                    <div className="mt-1 flex items-center justify-between">
                                        <span>標註數</span>
                                        <span className="font-mono text-white">{selectedDataset.label_count}</span>
                                    </div>
                                    <div className="mt-3 flex flex-wrap gap-2">
                                        {selectedDataset.classes.map(name => (
                                            <span key={name} className="rounded bg-slate-800 px-2 py-1 text-xs text-slate-200">{name}</span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <Field label="基礎模型">
                                <select
                                    value={config.model_type}
                                    onChange={event => patchConfig({ model_type: event.target.value })}
                                    disabled={status.is_running}
                                    className="control"
                                >
                                    {baseModels.map(model => <option key={model} value={model}>{model}</option>)}
                                </select>
                            </Field>

                            <div className="grid grid-cols-3 gap-3">
                                <Field label="訓練輪數">
                                    <input className="control" type="number" min={1} value={config.epochs} disabled={status.is_running} onChange={event => patchConfig({ epochs: Number(event.target.value) })} />
                                </Field>
                                <Field label="影像尺寸">
                                    <input className="control" type="number" min={64} value={config.img_size} disabled={status.is_running} onChange={event => patchConfig({ img_size: Number(event.target.value) })} />
                                </Field>
                                <Field label="批次大小">
                                    <input className="control" type="number" min={-1} value={config.batch_size} disabled={status.is_running} onChange={event => patchConfig({ batch_size: Number(event.target.value) })} />
                                </Field>
                            </div>

                            <Field label="訓練名稱">
                                <input className="control" value={config.run_name} disabled={status.is_running} onChange={event => patchConfig({ run_name: event.target.value })} />
                            </Field>
                        </div>

                        <div className="mt-5">
                            {!status.is_running ? (
                                <button onClick={startTraining} disabled={!datasets.length} className="action-green">
                                    <Play size={18} />
                                    開始訓練
                                </button>
                            ) : (
                                <button onClick={stopTraining} className="action-red">
                                    <Square size={18} />
                                    停止訓練
                                </button>
                            )}
                        </div>
                    </section>}

                    {mode === 'training' && <section className="rounded-lg border border-slate-800 bg-slate-900 p-5">
                        <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-white">
                            <ShieldCheck className="text-slate-300" size={20} />
                            模型驗證
                        </h3>

                        <div className="mb-4 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-3 text-sm leading-6 text-amber-100">
                            驗證資料集需要人工標籤。NG 圖片需標註框；OK 圖片可使用空 label 或無 label，系統會視為 OK 並在報告中列出無 label 檔數量。
                        </div>

                        <div className="space-y-4">
                            <Field label="待驗證模型">
                                <select
                                    className="control"
                                    value={validationForm.model_ref}
                                    onChange={event => setValidationForm(prev => ({ ...prev, model_ref: event.target.value }))}
                                    disabled={validating}
                                >
                                    <option value="">選擇模型</option>
                                    {validationModels.map(model => (
                                        <option key={model.model_ref} value={model.model_ref}>{model.name}</option>
                                    ))}
                                </select>
                            </Field>

                            <Field label="驗證資料集">
                                <select
                                    className="control"
                                    value={validationForm.validation_dataset_id}
                                    onChange={event => setValidationForm(prev => ({ ...prev, validation_dataset_id: event.target.value }))}
                                    disabled={validating}
                                >
                                    <option value="">選擇驗證資料集</option>
                                    {validationDatasets.map(dataset => (
                                        <option key={dataset.dataset_id} value={dataset.dataset_id}>{dataset.dataset_id}</option>
                                    ))}
                                </select>
                            </Field>

                            {selectedValidationDataset && (
                                <div className="rounded-md border border-slate-800 bg-slate-950 px-3 py-3 text-sm text-slate-300">
                                    <div className="flex items-center justify-between">
                                        <span>驗證圖片</span>
                                        <span className="font-mono text-white">{selectedValidationDataset.image_count}</span>
                                    </div>
                                    <div className="mt-1 flex items-center justify-between">
                                        <span>標註檔</span>
                                        <span className="font-mono text-white">{selectedValidationDataset.label_count}</span>
                                    </div>
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-3">
                                <Field label="信心閾值">
                                    <input className="control" type="number" step="0.01" min={0} max={1} value={validationForm.confidence_threshold} disabled={validating} onChange={event => setValidationForm(prev => ({ ...prev, confidence_threshold: Number(event.target.value) }))} />
                                </Field>
                                <Field label="IoU 閾值">
                                    <input className="control" type="number" step="0.01" min={0} max={1} value={validationForm.iou_threshold} disabled={validating} onChange={event => setValidationForm(prev => ({ ...prev, iou_threshold: Number(event.target.value) }))} />
                                </Field>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <Field label="最低合格率">
                                    <input className="control" type="number" step="0.01" min={0} max={1} value={validationForm.min_pass_rate} disabled={validating} onChange={event => setValidationForm(prev => ({ ...prev, min_pass_rate: Number(event.target.value) }))} />
                                </Field>
                                <Field label="最低 NG 檢出率">
                                    <input className="control" type="number" step="0.01" min={0} max={1} value={validationForm.min_ng_recall} disabled={validating} onChange={event => setValidationForm(prev => ({ ...prev, min_ng_recall: Number(event.target.value) }))} />
                                </Field>
                            </div>

                            <button onClick={validateModel} disabled={validating || !validationModels.length || !validationDatasets.length} className="action-blue">
                                <ClipboardCheck size={18} />
                                {validating ? '驗證中...' : '開始驗證'}
                            </button>
                        </div>
                    </section>}

                    {mode === 'deployment' && <section className="rounded-lg border border-slate-800 bg-slate-900 p-5">
                        <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-white">
                            <PackageCheck className="text-slate-300" size={20} />
                            建立部署模型包
                        </h3>

                        <div className="space-y-4">
                            <Field label="已完成訓練">
                                <select className="control" value={selectedRun} onChange={event => setSelectedRun(event.target.value)}>
                                    <option value="">選擇訓練 run</option>
                                    {runs.map(run => (
                                        <option key={run.run_name} value={run.run_name}>
                                            {run.has_best_model ? 'best.pt - ' : '尚無權重 - '}{run.run_name}{run.dataset_id ? ` / ${run.dataset_id}` : ''}
                                        </option>
                                    ))}
                                </select>
                            </Field>
                            <div className="grid grid-cols-2 gap-3">
                                <Field label="料號">
                                    <input className="control" value={bundleForm.part_no} onChange={event => setBundleForm(prev => ({ ...prev, part_no: event.target.value }))} />
                                </Field>
                                <Field label="版本">
                                    <input className="control" value={bundleForm.version} onChange={event => setBundleForm(prev => ({ ...prev, version: event.target.value }))} />
                                </Field>
                            </div>
                            <Field label="部署模型包 ID">
                                <input className="control" value={bundleForm.model_id} onChange={event => setBundleForm(prev => ({ ...prev, model_id: event.target.value }))} />
                            </Field>
                            <div className="grid grid-cols-2 gap-3">
                                <Field label="信心閾值">
                                    <input className="control" type="number" step="0.01" min={0} max={1} value={bundleForm.confidence_threshold} onChange={event => setBundleForm(prev => ({ ...prev, confidence_threshold: Number(event.target.value) }))} />
                                </Field>
                                <Field label="IoU 閾值">
                                    <input className="control" type="number" step="0.01" min={0} max={1} value={bundleForm.iou_threshold} onChange={event => setBundleForm(prev => ({ ...prev, iou_threshold: Number(event.target.value) }))} />
                                </Field>
                            </div>
                            <button onClick={packageBundle} className="action-blue">
                                <Archive size={18} />
                                建立部署模型包
                            </button>
                        </div>
                    </section>}
                </div>

                <div className="space-y-6">
                    {mode === 'training' && <section className="rounded-lg border border-slate-800 bg-slate-900 p-5">
                        <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
                            <Stat icon={Cpu} label="狀態" value={status.is_running ? '訓練中' : statusLabels[status.current_run?.status || ''] || '待命'} />
                            <Stat icon={Activity} label="進度" value={`${status.progress || 0}%`} />
                            <Stat icon={FolderOpen} label="輪數" value={`${status.current_epoch || 0}/${status.total_epochs || config.epochs}`} />
                            <Stat icon={CheckCircle2} label="最佳模型" value={status.current_run?.best_model_path ? '已有路徑' : '-'} />
                        </div>
                        <div className="h-3 overflow-hidden rounded bg-slate-800">
                            <div className="h-full bg-blue-500 transition-all duration-300" style={{ width: `${status.progress || 0}%` }} />
                        </div>
                    </section>}

                    {mode === 'training' && validationReport && (
                        <section className="rounded-lg border border-slate-800 bg-slate-900 p-5">
                            <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                                <h3 className="flex items-center gap-2 text-lg font-semibold text-white">
                                    <ShieldCheck size={20} className={validationReport.status === 'passed' ? 'text-green-400' : 'text-red-400'} />
                                    驗證報告
                                </h3>
                                <span className={`rounded px-3 py-1 text-sm font-semibold ${validationReport.status === 'passed' ? 'bg-green-500/15 text-green-300' : 'bg-red-500/15 text-red-300'}`}>
                                    {validationReport.status === 'passed' ? '通過' : '未通過'}
                                </span>
                            </div>

                            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                                <Stat icon={Activity} label="整體合格率" value={formatPercent(validationReport.summary.pass_rate)} />
                                <Stat icon={CheckCircle2} label="OK 正確率" value={formatPercent(validationReport.summary.ok_accuracy)} />
                                <Stat icon={ShieldCheck} label="NG 檢出率" value={formatPercent(validationReport.summary.ng_recall)} />
                                <Stat icon={FolderOpen} label="驗證圖片" value={`${validationReport.summary.total}`} />
                                <Stat icon={Cpu} label="漏判 NG" value={`${validationReport.summary.false_pass}`} />
                                <Stat icon={Cpu} label="誤殺 OK" value={`${validationReport.summary.false_reject}`} />
                                <Stat icon={FolderOpen} label="無 label 檔" value={`${validationReport.summary.missing_label_files}`} />
                                <Stat icon={CheckCircle2} label="正確張數" value={`${validationReport.summary.correct}/${validationReport.summary.total}`} />
                            </div>

                            {!!Object.keys(validationReport.class_stats).length && (
                                <div className="mt-5 overflow-hidden rounded-md border border-slate-800">
                                    <table className="w-full text-left text-sm">
                                        <thead className="bg-slate-950 text-xs uppercase text-slate-500">
                                            <tr>
                                                <th className="px-3 py-2">類別</th>
                                                <th className="px-3 py-2">真實 NG</th>
                                                <th className="px-3 py-2">檢出</th>
                                                <th className="px-3 py-2">召回率</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {Object.entries(validationReport.class_stats).map(([name, stats]) => (
                                                <tr key={name} className="border-t border-slate-800 text-slate-300">
                                                    <td className="px-3 py-2 text-white">{name}</td>
                                                    <td className="px-3 py-2">{stats.truth}</td>
                                                    <td className="px-3 py-2">{stats.detected}</td>
                                                    <td className="px-3 py-2">{formatPercent(stats.recall)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {!!validationReport.examples.length && (
                                <div className="mt-5">
                                    <h4 className="mb-2 text-sm font-semibold text-white">錯誤範例</h4>
                                    <div className="max-h-[220px] overflow-y-auto rounded-md border border-slate-800">
                                        {validationReport.examples.map(example => (
                                            <div key={example.image} className="border-b border-slate-800 px-3 py-2 text-sm text-slate-300 last:border-b-0">
                                                <div className="flex items-center justify-between gap-3">
                                                    <span className="truncate font-mono text-xs text-white">{example.image}</span>
                                                    <span className={example.result === '漏判' ? 'text-red-300' : 'text-amber-300'}>{example.result}</span>
                                                </div>
                                                <div className="mt-1 text-xs text-slate-500">
                                                    人工：{example.truth} {example.truth_classes.join(', ') || '-'} / 模型：{example.prediction} {example.predicted_classes.join(', ') || '-'}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </section>
                    )}

                    {mode === 'training' && <section className="rounded-lg border border-slate-800 bg-slate-900 p-5">
                        <h3 className="mb-4 text-lg font-semibold text-white">訓練指標</h3>
                        <div className="h-[310px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={chartData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                    <XAxis dataKey="epoch" stroke="#94a3b8" />
                                    <YAxis stroke="#94a3b8" />
                                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#fff' }} />
                                    <Legend />
                                    <Line type="monotone" dataKey="loss" stroke="#f43f5e" name="框選損失" dot={false} />
                                    <Line type="monotone" dataKey="map50" stroke="#22c55e" name="mAP@50" dot={false} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </section>}

                    {mode === 'training' && <section className="rounded-lg border border-slate-800 bg-black p-4">
                        <div className="mb-2 flex items-center gap-2 border-b border-slate-900 pb-2 font-mono text-sm text-slate-500">
                            <Terminal size={15} />
                            終端機輸出（完整）
                        </div>
                        <div className="h-[420px] overflow-y-auto font-mono text-sm">
                            {!status.logs?.length && <div className="text-slate-700">等待訓練輸出...</div>}
                            {status.logs?.map((log, index) => (
                                <div key={`${log}-${index}`} className="whitespace-pre-wrap break-words text-slate-300">{log}</div>
                            ))}
                            <div ref={logEndRef} />
                        </div>
                    </section>}

                    {mode === 'deployment' && <section className="rounded-lg border border-slate-800 bg-black p-4">
                        <div className="mb-2 flex items-center gap-2 border-b border-slate-900 pb-2 font-mono text-sm text-slate-500">
                            <Terminal size={15} />
                            部署 Console
                        </div>
                        <div className="h-[420px] overflow-y-auto font-mono text-sm">
                            {!deploymentLogs.length && <div className="text-slate-700">等待部署操作輸出...</div>}
                            {deploymentLogs.map((log, index) => (
                                <div key={`${log}-${index}`} className="whitespace-pre-wrap break-words text-slate-300">{log}</div>
                            ))}
                            <div ref={deploymentLogEndRef} />
                        </div>
                    </section>}

                    {mode === 'deployment' && <section className="rounded-lg border border-slate-800 bg-slate-900 p-5">
                        <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-white">
                            <Box size={20} className="text-slate-300" />
                            部署模型包清單
                        </h3>
                        <div className="overflow-hidden rounded-md border border-slate-800">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-slate-950 text-xs uppercase text-slate-500">
                                    <tr>
                                        <th className="px-3 py-2">模型</th>
                                        <th className="px-3 py-2">料號</th>
                                        <th className="px-3 py-2">格式</th>
                                        <th className="px-3 py-2">下載</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {bundles.map(bundle => (
                                        <tr key={bundle.model_id} className="border-t border-slate-800 text-slate-300">
                                            <td className="px-3 py-2 font-mono text-xs text-white">{bundle.model_id}</td>
                                            <td className="px-3 py-2">{bundle.part_no || '-'}</td>
                                            <td className="px-3 py-2">{bundle.format || '-'}</td>
                                            <td className="px-3 py-2">
                                                <a className="inline-flex items-center gap-1 text-blue-300 hover:text-blue-200" href={`/api/training/models/${bundle.model_id}/download`}>
                                                    <Download size={14} />
                                                    下載
                                                </a>
                                            </td>
                                        </tr>
                                    ))}
                                    {!bundles.length && (
                                        <tr>
                                            <td colSpan={4} className="px-3 py-8 text-center text-slate-600">尚未建立部署模型包。</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </section>}
                </div>
            </div>

            <style>{`
                .control {
                    width: 100%;
                    border-radius: 0.375rem;
                    border: 1px solid rgb(51 65 85);
                    background: rgb(2 6 23);
                    padding: 0.5rem 0.625rem;
                    color: white;
                    outline: none;
                }
                .control:focus {
                    border-color: rgb(59 130 246);
                }
                .control:disabled {
                    cursor: not-allowed;
                    opacity: 0.65;
                }
                .action-green, .action-red, .action-blue {
                    display: inline-flex;
                    width: 100%;
                    align-items: center;
                    justify-content: center;
                    gap: 0.5rem;
                    border-radius: 0.375rem;
                    padding: 0.75rem 1rem;
                    font-weight: 700;
                    color: white;
                    transition: background-color 160ms ease;
                }
                .action-green { background: rgb(22 163 74); }
                .action-green:hover { background: rgb(21 128 61); }
                .action-green:disabled { background: rgb(51 65 85); cursor: not-allowed; }
                .action-red { background: rgb(220 38 38); }
                .action-red:hover { background: rgb(185 28 28); }
                .action-blue { background: rgb(37 99 235); }
                .action-blue:hover { background: rgb(29 78 216); }
                .action-blue:disabled { background: rgb(51 65 85); cursor: not-allowed; }
            `}</style>
        </div>
    );
}

function formatPercent(value: number | null | undefined) {
    if (value === null || value === undefined) return '-';
    return `${Math.round(value * 1000) / 10}%`;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <label className="block">
            <span className="mb-1 block text-sm text-slate-400">{label}</span>
            {children}
        </label>
    );
}

function Stat({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
    return (
        <div className="rounded-md border border-slate-800 bg-slate-950 px-3 py-3">
            <div className="mb-2 flex items-center gap-2 text-xs uppercase text-slate-500">
                <Icon size={14} />
                {label}
            </div>
            <div className="truncate text-sm font-semibold text-white" title={value}>{value}</div>
        </div>
    );
}
