import * as React from "react"
import {
 Dialog,
 DialogContent,
 DialogDescription,
 DialogFooter,
 DialogHeader,
 DialogTitle,
} from "@/components/ui/Dialog"
import { Button } from "@/components/ui/Button"

interface ConfirmDialogProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	title: string
	description: string
	confirmText?: string
	cancelText?: string
	onConfirm: () => void
	onCancel?: () => void
	variant?: "default" | "destructive"
}

const ConfirmDialog = ({
	open,
	onOpenChange,
	title,
	description,
	confirmText = "确认",
	cancelText = "取消",
	onConfirm,
	onCancel,
	variant = "default",
}: ConfirmDialogProps) => {
	const handleConfirm = () => {
		onConfirm()
		onOpenChange(false)
	}

	const handleCancel = () => {
		onCancel?.()
		onOpenChange(false)
	}

	const handleOpenChange = (newOpen: boolean) => {
		if (!newOpen) {
			onCancel?.()
		}
		onOpenChange(newOpen)
	}

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>{title}</DialogTitle>
					<DialogDescription>{description}</DialogDescription>
				</DialogHeader>
				<DialogFooter>
					<Button variant="outline" onClick={handleCancel}>
						{cancelText}
					</Button>
					<Button variant={variant} onClick={handleConfirm}>
						{confirmText}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}

export default ConfirmDialog