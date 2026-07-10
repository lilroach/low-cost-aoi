import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { CheckCircle2, Database, ExternalLink, FolderOpen, Image as ImageIcon, PackageCheck, RefreshCw, ShieldCheck, TableProperties } from 'lucide-react';
import { EdgeSyncPanel } from './EdgeSyncPanel';

interface DatasetManagerProps {
    className?: string;
    onNavigateToLabeling?: () => void;
}

type InventoryItem = {
    id: string;
    category: string;
    path: string;
    folder_path?: string;
    updated_at?: number;
    image_count?: number;
    label_count?: number;
    classes?: string[];
    has_data_yaml?: boolean;
    has_classes_txt?: boolean;
    has_best_model?: boolean;
    best_model_path?: string | null;
    has_results_csv?: boolean;
    has_args_yaml?: boolean;
    status?: string;
    pass_rate?: number | null;
    ng_recall?: number | null;
    false_pass?: number | null;
    false_reject?: number | null;
    model_id?: string;
    part_no?: string;
    version?: string;
    format?: string;
    has_manifest?: boolean;
    has_weights?: boolean;
};

type InventoryGroups = {
    annotated_datasets: InventoryItem[];
    training_runs: InventoryItem[];
    validation_reports: InventoryItem[];
    validation_datasets: InventoryItem[];
    deployable_models: InventoryItem[];
};

const emptyGroups: InventoryGroups = {
    annotated_datasets: [],
    training_runs: [],
    validation_reports: [],
    validation_datasets: [],
    deployable_models: [],
};

export function DatasetManager({ className }: DatasetManagerProps) {
    const [groups, setGroups] = useState<InventoryGroups>(emptyGroups);
    const [loading, setLoading] = useState(false);
    const [notice, setNotice] = useState('');

    const fetchInventory = async () => {
        setLoading(true);
        setNotice('');
        try {
            const res = await fetch('/api/datasets/inventory');
            if (!res.ok) throw new Error('inventory failed');
            const data = await res.json();
            setGroups({ ...emptyGroups, ...(data.groups || {}) });
        } catch (error) {
            setNotice('讀取資料清單失敗，請確認後端服務是否啟動。');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchInventory();
    }, []);

    const totals = useMemo(() => ({
        annotated: groups.annotated_datasets.length,
        training: groups.training_runs.length,
        validationReports: groups.validation_reports.length,
        validationDatasets: groups.validation_datasets.length,
        deployable: groups.deployable_models.length,
    }), [groups]);

    const openFolder = async (item: InventoryItem) => {
        setNotice('');
        const res = await fetch(`/api/datasets/open-folder/${item.category}/${encodeURIComponent(item.id)}`, { method: 'POST' });
        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            setNotice(data.detail || '無法打開資料夾。');
            return;
        }
        setNotice(`已打開：${item.folder_path || item.path}`);
    };

    return (
        <div className={`space-y-6 ${className || ''}`}>
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                        <Database className="text-blue-400" />
                        資料集管理
                    </h2>
                    <p className="mt-1 text-sm text-slate-400">檢視標註、訓練、驗證與部署模型資產，並可直接打開對應資料夾。</p>
                </div>
                <button
                    onClick={fetchInventory}
                    className="inline-flex items-center gap-2 rounded-md border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800"
                >
                    <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                    重新整理
                </button>
            </div>

            <EdgeSyncPanel onSynced={fetchInventory} />

            {notice && (
                <div className="rounded-md border border-blue-500/30 bg-blue-500/10 px-4 py-3 text-sm text-blue-100">
                    {notice}
                </div>
            )}

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
                <Summary icon={ImageIcon} label="標註完成資料集" value={totals.annotated} />
                <Summary icon={CheckCircle2} label="訓練完成資料集" value={totals.training} />
                <Summary icon={ShieldCheck} label="驗證完成資料集" value={totals.validationReports} />
                <Summary icon={TableProperties} label="驗證資料集" value={totals.validationDatasets} />
                <Summary icon={PackageCheck} label="可部署模型" value={totals.deployable} />
            </div>

            <InventorySection
                title="標註完成資料集"
                description="已整理成 YOLO dataset 的訓練資料，通常包含 images、labels、classes.txt 或 data.yaml。"
                items={groups.annotated_datasets}
                emptyText="尚未找到標註完成資料集。"
                renderDetails={renderDatasetDetails}
                onOpen={openFolder}
            />

            <InventorySection
                title="訓練完成資料集"
                description="YOLO 訓練 run。若有 weights/best.pt，代表已有可驗證或可建立部署模型包的模型。"
                items={groups.training_runs}
                emptyText="尚未找到訓練完成資料集。"
                renderDetails={renderTrainingRunDetails}
                onOpen={openFolder}
            />

            <InventorySection
                title="驗證完成資料集"
                description="模型驗證報告，包含合格率、NG 檢出率、漏判與誤殺統計。"
                items={groups.validation_reports}
                emptyText="尚未找到驗證報告。"
                renderDetails={renderValidationReportDetails}
                onOpen={openFolder}
            />

            <InventorySection
                title="驗證資料集"
                description="用於模型驗證的額外資料，需與訓練資料分開保存。"
                items={groups.validation_datasets}
                emptyText="尚未找到驗證資料集。"
                renderDetails={renderDatasetDetails}
                onOpen={openFolder}
            />

            <InventorySection
                title="可部署模型"
                description="已建立 manifest.json 與 best.pt 的部署模型包，可下載或複製到 Edge Simulator。"
                items={groups.deployable_models}
                emptyText="尚未找到可部署模型。"
                renderDetails={renderDeployableModelDetails}
                onOpen={openFolder}
            />
        </div>
    );
}

function InventorySection({ title, description, items, emptyText, renderDetails, onOpen }: {
    title: string;
    description: string;
    items: InventoryItem[];
    emptyText: string;
    renderDetails: (item: InventoryItem) => ReactNode;
    onOpen: (item: InventoryItem) => void;
}) {
    return (
        <section className="rounded-lg border border-slate-800 bg-slate-900 p-5">
            <div className="mb-4">
                <h3 className="text-lg font-semibold text-white">{title}</h3>
                <p className="mt-1 text-sm text-slate-400">{description}</p>
            </div>

            <div className="space-y-3">
                {items.map(item => (
                    <div key={`${item.category}-${item.id}`} className="rounded-md border border-slate-800 bg-slate-950 px-4 py-3">
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                            <div className="min-w-0">
                                <div className="truncate font-mono text-sm font-semibold text-white" title={item.id}>{item.id}</div>
                                <div className="mt-1 truncate text-xs text-slate-500" title={item.folder_path || item.path}>{item.folder_path || item.path}</div>
                            </div>
                            <button
                                onClick={() => onOpen(item)}
                                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-md border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800"
                            >
                                <FolderOpen size={15} />
                                打開資料夾
                            </button>
                        </div>
                        <div className="mt-3">{renderDetails(item)}</div>
                    </div>
                ))}
                {!items.length && (
                    <div className="rounded-md border border-slate-800 bg-slate-950 px-4 py-8 text-center text-sm text-slate-600">
                        {emptyText}
                    </div>
                )}
            </div>
        </section>
    );
}

function renderDatasetDetails(item: InventoryItem) {
    return (
        <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <Info label="圖片" value={item.image_count ?? 0} />
                <Info label="標註檔" value={item.label_count ?? 0} />
                <Info label="data.yaml" value={item.has_data_yaml ? '有' : '無'} />
                <Info label="classes.txt" value={item.has_classes_txt ? '有' : '無'} />
            </div>
            <ClassChips classes={item.classes || []} />
        </div>
    );
}

function renderTrainingRunDetails(item: InventoryItem) {
    return (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Info label="best.pt" value={item.has_best_model ? '有' : '無'} />
            <Info label="results.csv" value={item.has_results_csv ? '有' : '無'} />
            <Info label="args.yaml" value={item.has_args_yaml ? '有' : '無'} />
            <Info label="更新時間" value={formatDate(item.updated_at)} />
        </div>
    );
}

function renderValidationReportDetails(item: InventoryItem) {
    return (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <Info label="狀態" value={item.status === 'passed' ? '通過' : item.status === 'failed' ? '未通過' : '-'} />
            <Info label="合格率" value={formatPercent(item.pass_rate)} />
            <Info label="NG 檢出率" value={formatPercent(item.ng_recall)} />
            <Info label="漏判" value={item.false_pass ?? '-'} />
            <Info label="誤殺" value={item.false_reject ?? '-'} />
        </div>
    );
}

function renderDeployableModelDetails(item: InventoryItem) {
    return (
        <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                <Info label="料號" value={item.part_no || '-'} />
                <Info label="版本" value={item.version || '-'} />
                <Info label="格式" value={item.format || '-'} />
                <Info label="manifest" value={item.has_manifest ? '有' : '無'} />
                <Info label="權重" value={item.has_weights ? '有' : '無'} />
            </div>
            <ClassChips classes={item.classes || []} />
            <a className="inline-flex items-center gap-1 text-sm text-blue-300 hover:text-blue-200" href={`/api/training/models/${item.id}/download`}>
                <ExternalLink size={14} />
                下載部署模型包
            </a>
        </div>
    );
}

function Summary({ icon: Icon, label, value }: { icon: any; label: string; value: number }) {
    return (
        <div className="rounded-lg border border-slate-800 bg-slate-900 px-4 py-3">
            <div className="mb-2 flex items-center gap-2 text-xs text-slate-500">
                <Icon size={15} />
                {label}
            </div>
            <div className="font-mono text-2xl font-semibold text-white">{value}</div>
        </div>
    );
}

function Info({ label, value }: { label: string; value: ReactNode }) {
    return (
        <div className="rounded-md border border-slate-800 bg-slate-900 px-3 py-2">
            <div className="text-xs text-slate-500">{label}</div>
            <div className="mt-1 truncate text-sm font-semibold text-slate-100" title={String(value)}>{value}</div>
        </div>
    );
}

function ClassChips({ classes }: { classes: string[] }) {
    if (!classes.length) return null;
    return (
        <div className="flex flex-wrap gap-2">
            {classes.map(name => (
                <span key={name} className="rounded bg-slate-800 px-2 py-1 text-xs text-slate-200">{name}</span>
            ))}
        </div>
    );
}

function formatDate(timestamp?: number) {
    if (!timestamp) return '-';
    return new Date(timestamp * 1000).toLocaleString('zh-TW', { hour12: false });
}

function formatPercent(value?: number | null) {
    if (value === null || value === undefined) return '-';
    return `${Math.round(value * 1000) / 10}%`;
}
