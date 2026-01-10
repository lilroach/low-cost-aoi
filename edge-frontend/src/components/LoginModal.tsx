interface LoginModalProps {
    show: boolean
    setShow: (show: boolean) => void
    setUserRole: (role: 'engineer' | 'operator' | null) => void
    setTab: (tab: any) => void
}

export function LoginModal({ show, setShow, setUserRole, setTab }: LoginModalProps) {
    if (!show) return null
    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center">
            <div className="bg-zinc-900 border border-zinc-700 p-8 rounded-2xl w-full max-w-sm shadow-2xl space-y-6">
                <div className="text-center space-y-2">
                    <div className="w-12 h-12 bg-blue-600 rounded-lg mx-auto flex items-center justify-center mb-4">
                        <span className="text-2xl font-bold text-white">E</span>
                    </div>
                    <h2 className="text-2xl font-bold text-white">AOI Edge Login</h2>
                    <p className="text-zinc-500 text-sm">Select your role to continue</p>
                </div>

                <div className="space-y-3">
                    <button onClick={() => { setUserRole('operator'); setShow(false); setTab('run') }} className="w-full py-4 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-xl flex items-center justify-between px-6 group transition-all">
                        <span className="font-bold text-zinc-300 group-hover:text-white">Operator</span>
                        <span className="text-xs bg-zinc-900 px-2 py-1 rounded text-zinc-500">Run Only</span>
                    </button>

                    <button onClick={() => { setUserRole('engineer'); setShow(false) }} className="w-full py-4 bg-blue-600/10 hover:bg-blue-600/20 border border-blue-500/30 hover:border-blue-500/50 rounded-xl flex items-center justify-between px-6 group transition-all">
                        <span className="font-bold text-blue-400 group-hover:text-blue-300">Engineer</span>
                        <span className="text-xs bg-blue-900/30 px-2 py-1 rounded text-blue-300">Full Access</span>
                    </button>
                </div>
            </div>
        </div>
    )
}
