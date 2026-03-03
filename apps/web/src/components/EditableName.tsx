import { useRef, useState } from "react";
import { fetchApi } from "../lib/api";

interface EditableNameProps {
	sessionId: string;
	name: string | null;
	className?: string;
	inputClassName?: string;
	onSaved?: (name: string | null) => void;
}

export default function EditableName({
	sessionId,
	name,
	className = "",
	inputClassName = "",
	onSaved,
}: EditableNameProps) {
	const [isEditing, setIsEditing] = useState(false);
	const [value, setValue] = useState(name ?? "");
	const inputRef = useRef<HTMLInputElement>(null);

	function startEditing(e: React.MouseEvent) {
		e.stopPropagation();
		e.preventDefault();
		setValue(name ?? "");
		setIsEditing(true);
		requestAnimationFrame(() => inputRef.current?.select());
	}

	async function save() {
		setIsEditing(false);
		const trimmed = value.trim();
		const newName = trimmed || null;
		if (newName === name) return;

		const res = await fetchApi(`/sessions/${sessionId}`, {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ name: trimmed }),
		});
		if (res.ok) {
			onSaved?.(newName);
		}
	}

	function handleKeyDown(e: React.KeyboardEvent) {
		if (e.key === "Enter") {
			e.preventDefault();
			save();
		} else if (e.key === "Escape") {
			setIsEditing(false);
		}
	}

	if (isEditing) {
		return (
			<input
				ref={inputRef}
				value={value}
				onChange={(e) => setValue(e.target.value)}
				onBlur={save}
				onKeyDown={handleKeyDown}
				placeholder="Untitled"
				className={`bg-transparent outline-none ring-1 ring-primary/30 rounded px-1 ${inputClassName}`}
			/>
		);
	}

	return (
		<button
			type="button"
			onClick={startEditing}
			className={`hover:underline decoration-dashed underline-offset-4 cursor-text text-left ${className}`}
			title="Click to rename"
		>
			{name || <span className="text-muted-foreground">Untitled</span>}
		</button>
	);
}
