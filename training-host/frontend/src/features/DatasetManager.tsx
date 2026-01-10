import { useState, useEffect } from 'react';
import { Upload, Image as ImageIcon, RefreshCw, Trash2, Tag } from 'lucide-react';

interface DatasetManagerProps {
    className?: string;
    onNavigateToLabeling?: () => void;
}

export function DatasetManager({ className, onNavigateToLabeling }: DatasetManagerProps) {
    const [images, setImages] = useState<string[]>([]);
    const [uploading, setUploading] = useState(false);

    const fetchImages = async () => {
        try {
            const res = await fetch('/api/datasets/');
            if (res.ok) {
                const data = await res.json();
                setImages(data.images || []);
            }
        } catch (err) {
            console.error("Failed to fetch images", err);
        }
    };

    useEffect(() => {
        fetchImages();
    }, []);

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files?.length) return;

        setUploading(true);
        const formData = new FormData();
        Array.from(e.target.files).forEach(file => {
            formData.append('files', file);
        });

        try {
            await fetch('/api/datasets/upload', {
                method: 'POST',
                body: formData,
            });
            await fetchImages(); // Refresh list
        } catch (err) {
            console.error("Upload failed", err);
        } finally {
            setUploading(false);
            // Reset input
            e.target.value = '';
        }
    };

    const handleDelete = async (filename: string) => {
        if (!confirm(`Are you sure you want to delete ${filename}?`)) return;

        try {
            const res = await fetch(`/api/datasets/${filename}`, { method: 'DELETE' });
            if (res.ok) {
                setImages(prev => prev.filter(img => img !== filename));
            }
        } catch (err) {
            console.error("Delete failed", err);
        }
    };

    return (
        <div className={`space-y-6 ${className}`}>
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                    <ImageIcon className="text-blue-400" />
                    Dataset Management
                </h2>
                <button
                    onClick={fetchImages}
                    className="p-2 hover:bg-slate-800 rounded-full text-slate-400 transition-colors"
                >
                    <RefreshCw size={20} />
                </button>
            </div>

            {/* Upload Zone */}
            <div className="border-2 border-dashed border-slate-700 rounded-xl p-8 hover:border-blue-500 transition-colors text-center group cursor-pointer relative">
                <input
                    type="file"
                    multiple
                    accept="image/*"
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    onChange={handleUpload}
                    disabled={uploading}
                />
                <div className="flex flex-col items-center gap-2 text-slate-400 group-hover:text-blue-400">
                    <Upload size={48} className={uploading ? "animate-bounce" : ""} />
                    <p className="font-medium text-lg">
                        {uploading ? "Uploading..." : "Drop images here or click to upload"}
                    </p>
                    <p className="text-sm text-slate-600">Supports PNG, JPG, BMP</p>
                </div>
            </div>

            {/* Gallery Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {images.map((img) => (
                    <div key={img} className="group relative aspect-square bg-slate-900 rounded-lg overflow-hidden border border-slate-800">
                        <img
                            src={`/api/data/raw/${img}`}
                            alt={img}
                            className="w-full h-full object-cover transition-transform group-hover:scale-105"
                        />
                        <div className="absolute inset-x-0 bottom-0 bg-black/80 p-2 opacity-0 group-hover:opacity-100 transition-opacity flex justify-between items-center">
                            <p className="text-xs text-white truncate flex-1 mr-2" title={img}>{img}</p>
                            <div className="flex gap-1">
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onNavigateToLabeling?.();
                                    }}
                                    className="text-blue-400 hover:text-blue-300 p-1 hover:bg-blue-400/20 rounded"
                                    title="Go to Labeling"
                                >
                                    <Tag size={14} />
                                </button>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleDelete(img);
                                    }}
                                    className="text-red-400 hover:text-red-300 p-1 hover:bg-red-400/20 rounded"
                                    title="Delete Image"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
                {images.length === 0 && (
                    <div className="col-span-full py-12 text-center text-slate-600">
                        No images found. Upload some to get started.
                    </div>
                )}
            </div>
        </div>
    );
}
