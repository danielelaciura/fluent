export type RecordingState = "idle" | "recording" | "uploading" | "processing" | "error";

export interface MeetState {
	onMeetTab: boolean;
	meetTabId: number | null;
}

const STORAGE_KEY = "recordingState";
const MEET_STATE_KEY = "meetState";
const SESSION_ID_KEY = "lastSessionId";
const UPLOAD_ERROR_KEY = "uploadError";
const RECORDING_STARTED_AT_KEY = "recordingStartedAt";

export async function getRecordingState(): Promise<RecordingState> {
	const result = await chrome.storage.local.get(STORAGE_KEY);
	return (result[STORAGE_KEY] as RecordingState) ?? "idle";
}

export async function setRecordingState(state: RecordingState): Promise<void> {
	await chrome.storage.local.set({ [STORAGE_KEY]: state });
}

export async function getMeetState(): Promise<MeetState> {
	const result = await chrome.storage.local.get(MEET_STATE_KEY);
	return (result[MEET_STATE_KEY] as MeetState) ?? { onMeetTab: false, meetTabId: null };
}

export async function setMeetState(state: MeetState): Promise<void> {
	await chrome.storage.local.set({ [MEET_STATE_KEY]: state });
}

export async function getLastSessionId(): Promise<string | null> {
	const result = await chrome.storage.local.get(SESSION_ID_KEY);
	return (result[SESSION_ID_KEY] as string) ?? null;
}

export async function setLastSessionId(sessionId: string | null): Promise<void> {
	await chrome.storage.local.set({ [SESSION_ID_KEY]: sessionId });
}

export async function getUploadError(): Promise<string | null> {
	const result = await chrome.storage.local.get(UPLOAD_ERROR_KEY);
	return (result[UPLOAD_ERROR_KEY] as string) ?? null;
}

export async function setUploadError(error: string | null): Promise<void> {
	await chrome.storage.local.set({ [UPLOAD_ERROR_KEY]: error });
}

export async function getRecordingStartedAt(): Promise<number | null> {
	const result = await chrome.storage.local.get(RECORDING_STARTED_AT_KEY);
	return (result[RECORDING_STARTED_AT_KEY] as number) ?? null;
}

export async function setRecordingStartedAt(timestamp: number | null): Promise<void> {
	await chrome.storage.local.set({ [RECORDING_STARTED_AT_KEY]: timestamp });
}
