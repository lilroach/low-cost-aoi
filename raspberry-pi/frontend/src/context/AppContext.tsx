import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'

interface Program {
    name: string
    refs: any[]
    points: any[]
}

interface AppContextType {
    tab: 'motion' | 'teaching' | 'run' | 'review' | 'capture' | 'transfer'
    setTab: (tab: any) => void
    userRole: 'engineer' | 'operator' | null
    setUserRole: (role: any) => void
    program: Program
    setProgram: (p: any) => void
    progList: any[]
    setProgList: (list: any[]) => void
    fetchProgram: () => Promise<void>
    fetchProgList: () => Promise<void>
    programName: string
    setProgramName: (name: string) => void
    alignState: 'idle' | 'aligning_ref' | 'calculating' | 'running'
    setAlignState: (state: any) => void
    partNo: string
    setPartNo: (v: string) => void
    batchNo: string
    setBatchNo: (v: string) => void
    showLogin: boolean
    setShowLogin: (show: boolean) => void
}

const AppContext = createContext<AppContextType | undefined>(undefined)

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [tab, setTab] = useState<'motion' | 'teaching' | 'run' | 'review' | 'capture' | 'transfer'>('capture')
    const [userRole, setUserRole] = useState<'engineer' | 'operator' | null>(null)
    const [program, setProgram] = useState<Program>({ name: "Untitled", refs: [], points: [] })
    const [progList, setProgList] = useState<any[]>([])
    const [programName, setProgramName] = useState("")
    const [alignState, setAlignState] = useState<'idle' | 'aligning_ref' | 'calculating' | 'running'>('idle')
    const [partNo, setPartNo] = useState("")
    const [batchNo, setBatchNo] = useState("")
    const [showLogin, setShowLogin] = useState(true)

    const fetchProgram = useCallback(async () => {
        try {
            const res = await fetch('/api/program/current')
            setProgram(await res.json())
        } catch (e) { }
    }, [])

    const fetchProgList = useCallback(async () => {
        try {
            const res = await fetch('/api/program/list')
            setProgList(await res.json())
        } catch (e) { }
    }, [])

    useEffect(() => {
        fetchProgram()
        fetchProgList()
    }, [fetchProgram, fetchProgList])

    return (
        <AppContext.Provider value={{
            tab, setTab, userRole, setUserRole,
            program, setProgram, progList, setProgList,
            fetchProgram, fetchProgList,
            programName, setProgramName,
            alignState, setAlignState,
            partNo, setPartNo,
            batchNo, setBatchNo,
            showLogin, setShowLogin
        }}>
            {children}
        </AppContext.Provider>
    )
}

export const useApp = () => {
    const context = useContext(AppContext)
    if (!context) throw new Error("useApp must be used within an AppProvider")
    return context
}
