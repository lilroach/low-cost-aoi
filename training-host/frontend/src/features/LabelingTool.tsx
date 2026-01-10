import { ExternalLink, Tag } from 'lucide-react';

export function LabelingTool() {
    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                    <Tag className="text-blue-400" />
                    Data Labeling (Label Studio)
                </h2>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 hover:border-blue-500 transition-colors">
                <div className="flex flex-col md:flex-row gap-8 items-start">
                    <div className="flex-1">
                        <h3 className="text-2xl font-semibold text-white mb-4">Label Studio Integrated</h3>
                        <p className="text-slate-400 mb-6 text-lg leading-relaxed">
                            A powerful, open-source data labeling tool is now running within your Docker environment.
                            Use this to annotate your defects (Bounding Box, Polygon) in YOLO format.
                        </p>

                        <div className="grid grid-cols-2 gap-4 mb-8 max-w-md">
                            <div className="p-4 bg-slate-950 rounded border border-slate-800">
                                <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Username</p>
                                <p className="font-mono text-blue-300">admin@aoi.com</p>
                            </div>
                            <div className="p-4 bg-slate-950 rounded border border-slate-800">
                                <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Password</p>
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
                            Launch Label Studio
                        </a>
                    </div>

                    <div className="w-full md:w-1/3 bg-slate-950 p-6 rounded-lg border border-slate-800 text-sm text-slate-400">
                        <h4 className="text-white font-medium mb-3">Quick Start Guide:</h4>
                        <ol className="list-decimal pl-4 space-y-2">
                            <li>Launch Label Studio and login.</li>
                            <li>Create a new project (e.g., "PCB Defects").</li>
                            <li>In "Import", select <strong>Cloud Storage</strong> &rarr; <strong>Add Source</strong>.</li>
                            <li>Choose <strong>Local files</strong>.</li>
                            <li>Set "Absolute local path" to: <code className="text-yellow-500">/label-studio/files</code></li>
                            <li>Toggle "Treat every bucket object as a source file".</li>
                            <li>Click "Check Connection" then "Save".</li>
                            <li>Click "Sync" to load your images.</li>
                        </ol>
                    </div>
                </div>
            </div>
        </div>
    );
}
