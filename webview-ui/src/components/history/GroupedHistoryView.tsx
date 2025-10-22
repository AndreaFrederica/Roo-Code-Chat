import React, { memo } from "react"
import HistoryView from "./HistoryView"

type GroupedHistoryViewProps = {
	onDone: () => void
}

const GroupedHistoryView = ({ onDone }: GroupedHistoryViewProps) => {
	return <HistoryView onDone={onDone} />
}

export default memo(GroupedHistoryView)
