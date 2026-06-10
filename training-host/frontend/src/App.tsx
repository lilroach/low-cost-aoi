import { useEffect, useState } from 'react'
import { DatasetManager } from './features/DatasetManager'
import { LabelingTool } from './features/LabelingTool'
import { TrainingMonitor } from './features/TrainingMonitor'
import { Server, Image, Tag, BarChart, BookOpen, PackageCheck } from 'lucide-react'

type Tab = 'datasets' | 'labeling' | 'training' | 'deployment' | 'manual';

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
                            <span className="font-semibold text-lg">AOI 訓練主機</span>
                        </div>

                        {/* Navigation Tabs */}
                        <div className="flex items-center gap-1">
                            <NavButton
                                active={currentTab === 'datasets'}
                                onClick={() => setCurrentTab('datasets')}
                                icon={Image}
                                label="資料集"
                            />
                            <NavButton
                                active={currentTab === 'labeling'}
                                onClick={() => setCurrentTab('labeling')}
                                icon={Tag}
                                label="標註"
                            />
                            <NavButton
                                active={currentTab === 'training'}
                                onClick={() => setCurrentTab('training')}
                                icon={BarChart}
                                label="訓練+驗證"
                            />
                            <NavButton
                                active={currentTab === 'deployment'}
                                onClick={() => setCurrentTab('deployment')}
                                icon={PackageCheck}
                                label="部署"
                            />
                            <NavButton
                                active={currentTab === 'manual'}
                                onClick={() => setCurrentTab('manual')}
                                icon={BookOpen}
                                label="說明書"
                            />
                        </div>
                    </div>

                    <div className="flex items-center gap-4 text-sm">
                        <StatusBadge label="API" status={status?.status === 'online'} icon={Server} />
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
                    {currentTab === 'training' && <TrainingMonitor mode="training" />}
                    {currentTab === 'deployment' && <TrainingMonitor mode="deployment" />}
                    {currentTab === 'manual' && <OperationManual onGoTraining={() => setCurrentTab('training')} onGoDeployment={() => setCurrentTab('deployment')} onGoDatasets={() => setCurrentTab('datasets')} onGoLabeling={() => setCurrentTab('labeling')} />}
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

function OperationManual({ onGoTraining, onGoDeployment, onGoDatasets, onGoLabeling }: { onGoTraining: () => void, onGoDeployment: () => void, onGoDatasets: () => void, onGoLabeling: () => void }) {
    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                        <BookOpen className="text-blue-400" />
                        Training Host 操作說明書
                    </h2>
                    <p className="mt-1 text-sm text-slate-400">依照順序完成資料上傳、標註、YOLO11 訓練、模型驗證與部署模型包建立。</p>
                </div>
                <button onClick={onGoTraining} className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500">
                    <BarChart size={16} />
                    前往訓練+驗證
                </button>
            </div>

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                <ManualSection title="1. 匯入訓練圖片" action="前往資料集" onAction={onGoDatasets}>
                    <li>進入「資料集」頁面。</li>
                    <li>將 PCB 圖片拖曳到上傳區，或點擊上傳區選擇圖片。</li>
                    <li>確認圖片縮圖有出現在清單中。</li>
                    <li>建議 OK、毛絲、殘肉各累積足夠樣本後再訓練。</li>
                </ManualSection>

                <ManualSection title="2. 進行缺陷標註" action="前往標註" onAction={onGoLabeling}>
                    <li>進入「標註」頁面，開啟 Label Studio。</li>
                    <li>使用帳號 <code className="text-blue-300">admin@aoi.com</code> 登入。</li>
                    <li>在圖片上框選缺陷位置，類別需與資料集類別一致。</li>
                    <li>標註完成後匯出 YOLO ZIP，回到「標註」頁使用匯入工具建立訓練資料集。</li>
                </ManualSection>

                <ManualSection title="3. 啟動 YOLO11 訓練" action="前往訓練" onAction={onGoTraining}>
                    <li>在「訓練」頁選擇資料集，例如 <code className="text-blue-300">testv1</code>。</li>
                    <li>選擇 base model，預設建議 <code className="text-blue-300">yolo11n.pt</code>。</li>
                    <li>設定 epochs、影像尺寸、batch 與 run name。</li>
                    <li>按下「開始訓練」，右側可查看進度、log 與 metrics。</li>
                </ManualSection>

                <ManualSection title="4. 準備驗證資料包">
                    <li>驗證資料需放在 <code className="text-blue-300">data/validation-datasets/&lt;dataset&gt;</code>。</li>
                    <li>資料夾需包含 <code className="text-blue-300">data.yaml</code>、<code className="text-blue-300">images/</code>、<code className="text-blue-300">labels/</code>。</li>
                    <li>NG 圖片必須用 Label Studio 標註缺陷框並匯出 YOLO 標籤。</li>
                    <li>OK 圖片可使用空 label 檔，或沒有 label 檔；系統會視為人工 OK。</li>
                </ManualSection>

                <ManualSection title="5. 驗證模型合格率" action="前往訓練" onAction={onGoTraining}>
                    <li>在「模型驗證」區選擇剛訓練完的 run 或已建立的部署模型包。</li>
                    <li>選擇驗證資料集，設定 confidence、IoU 與最低合格門檻。</li>
                    <li>按「開始驗證」後查看整體合格率、OK 正確率、NG 檢出率。</li>
                    <li>特別檢查「漏判 NG」，AOI 場景通常漏判比誤殺更嚴重。</li>
                </ManualSection>

                <ManualSection title="6. 建立部署模型包" action="前往部署" onAction={onGoDeployment}>
                    <li>訓練完成後，確認 run 清單顯示 <code className="text-blue-300">best.pt</code>。</li>
                    <li>填入料號、版本與部署模型包 ID。</li>
                    <li>依需求設定 confidence 與 IoU 閾值。</li>
                    <li>按下「建立部署模型包」，系統會產生 <code className="text-blue-300">manifest.json + best.pt</code>。</li>
                </ManualSection>

                <ManualSection title="7. 下載與部署驗證">
                    <li>在「部署模型包清單」按「下載」。</li>
                    <li>將 zip 解開後放到 Windows Edge Simulator 的 <code className="text-blue-300">models/&lt;model_id&gt;</code>。</li>
                    <li>刷新 Edge Simulator 模型清單，選擇新模型進行 SNAP 驗證。</li>
                    <li>若模型多數 No Match，請補更多樣本後重新訓練。</li>
                </ManualSection>

                <ManualSection title="注意事項">
                    <li>目前打包格式是 Windows Edge Simulator 使用的 <code className="text-blue-300">ultralytics-pt</code>。</li>
                    <li>Raspberry Pi Hailo <code className="text-blue-300">.hef</code> 匯出仍屬後續流程。</li>
                    <li>合格率必須依賴人工標籤；沒有標籤只能做推論展示，不能計算可信合格率。</li>
                    <li>訓練中不要重複按開始；若參數錯誤，先按「停止訓練」。</li>
                    <li>YOLO OK 代表沒有 detection 超過閾值，不等於保證沒有缺陷。</li>
                </ManualSection>
            </div>
        </div>
    )
}

function ManualSection({ title, action, onAction, children }: { title: string, action?: string, onAction?: () => void, children: React.ReactNode }) {
    return (
        <section className="rounded-lg border border-slate-800 bg-slate-900 p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
                <h3 className="text-lg font-semibold text-white">{title}</h3>
                {action && onAction && (
                    <button onClick={onAction} className="rounded-md border border-slate-700 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-800">
                        {action}
                    </button>
                )}
            </div>
            <ol className="list-decimal space-y-2 pl-5 text-sm leading-6 text-slate-300">
                {children}
            </ol>
        </section>
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
