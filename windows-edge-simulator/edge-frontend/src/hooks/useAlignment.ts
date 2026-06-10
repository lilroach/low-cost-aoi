import { useState, useCallback } from 'react'

export type AlignState = 'idle' | 'aligning_ref' | 'calculating' | 'running'

export const useAlignment = (program: any, status: any, moveToAbsolute: any) => {
    const [alignState, setAlignState] = useState<AlignState>('idle')
    const [currentAlignRefIndex, setCurrentAlignRefIndex] = useState(0)
    const [runtimeRefs, setRuntimeRefs] = useState<any[]>([])

    const startAlignment = useCallback(async () => {
        if (program.refs.length < 2) return alert("Need at least 2 Refs to align!")
        setAlignState('aligning_ref')
        setCurrentAlignRefIndex(0)
        setRuntimeRefs([])
        await moveToAbsolute(program.refs[0].x, program.refs[0].y)
    }, [program, moveToAbsolute])

    const confirmCurrentRef = useCallback(async () => {
        const p = {
            id: program.refs[currentAlignRefIndex].id,
            x: status.machine.x,
            y: status.machine.y,
            type: 'ref'
        }
        const newRefs = [...runtimeRefs, p]
        setRuntimeRefs(newRefs)

        const nextIdx = currentAlignRefIndex + 1
        if (nextIdx < program.refs.length) {
            setCurrentAlignRefIndex(nextIdx)
            await moveToAbsolute(program.refs[nextIdx].x, program.refs[nextIdx].y)
        } else {
            setAlignState('calculating')
            return newRefs // Return for calculation
        }
    }, [program, currentAlignRefIndex, status, runtimeRefs, moveToAbsolute])

    return {
        alignState, setAlignState, currentAlignRefIndex, setCurrentAlignRefIndex,
        runtimeRefs, setRuntimeRefs, startAlignment, confirmCurrentRef
    }
}
