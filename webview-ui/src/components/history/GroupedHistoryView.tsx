import React, { memo } from "react"
import WeChatHistoryView from "./WeChatHistoryView"

type GroupedHistoryViewProps = {
	onDone: () => void
}

const GroupedHistoryView = ({ onDone }: GroupedHistoryViewProps) => {
	return <WeChatHistoryView onDone={onDone} />
}

export default memo(GroupedHistoryView)