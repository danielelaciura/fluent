import { createSession, uploadSession } from "../lib/api.js";
import * as auth from "../lib/auth.js";
import {
	type RecordingState,
	getLastSessionId,
	getMeetState,
	getRecordingState,
	getUploadError,
	setLastSessionId,
	setMeetState,
	setRecordingState,
	setUploadError,
} from "../lib/state.js";

const OFFSCREEN_URL = "src/offscreen/offscreen.html";

async function updateBadge() {
	const recording = await getRecordingState();
	const meet = await getMeetState();

	if (recording === "recording") {
		chrome.action.setBadgeText({ text: "REC" });
		chrome.action.setBadgeBackgroundColor({ color: "#EF4444" });
	} else if (recording === "uploading") {
		chrome.action.setBadgeText({ text: "..." });
		chrome.action.setBadgeBackgroundColor({ color: "#3B82F6" });
	} else if (recording === "processing") {
		chrome.action.setBadgeText({ text: "✓" });
		chrome.action.setBadgeBackgroundColor({ color: "#22C55E" });
	} else if (recording === "error") {
		chrome.action.setBadgeText({ text: "!" });
		chrome.action.setBadgeBackgroundColor({ color: "#EF4444" });
	} else if (meet.onMeetTab) {
		chrome.action.setBadgeText({ text: "M" });
		chrome.action.setBadgeBackgroundColor({ color: "#22C55E" });
	} else {
		chrome.action.setBadgeText({ text: "" });
	}
}

async function ensureOffscreenDocument(): Promise<void> {
	const contexts = await chrome.runtime.getContexts({
		contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT],
	});
	if (contexts.length === 0) {
		await chrome.offscreen.createDocument({
			url: OFFSCREEN_URL,
			reasons: [chrome.offscreen.Reason.USER_MEDIA],
			justification: "Recording tab audio via MediaRecorder",
		});
	}

	// Wait for offscreen script to be ready (handles race condition)
	for (let i = 0; i < 10; i++) {
		try {
			const resp = await chrome.runtime.sendMessage({ type: "PING" });
			if (resp?.ok) return;
		} catch {
			// Not ready yet
		}
		await new Promise((r) => setTimeout(r, 100));
	}
	throw new Error("Offscreen document failed to initialize");
}

async function closeOffscreenDocument(): Promise<void> {
	const contexts = await chrome.runtime.getContexts({
		contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT],
	});
	if (contexts.length > 0) {
		await chrome.offscreen.closeDocument();
	}
}

async function startRecording(): Promise<RecordingState> {
	const meet = await getMeetState();
	if (!meet.onMeetTab || meet.meetTabId == null) {
		throw new Error("No active Meet tab");
	}

	const streamId = await chrome.tabCapture.getMediaStreamId({
		targetTabId: meet.meetTabId,
	});

	await ensureOffscreenDocument();

	const response = await chrome.runtime.sendMessage({
		type: "START_RECORDING",
		streamId,
	});

	if (!response?.ok) {
		throw new Error(response?.error ?? "Failed to start recording");
	}

	await setRecordingState("recording");
	await setUploadError(null);

	// Notify content script
	chrome.tabs.sendMessage(meet.meetTabId, { type: "RECORDING_STARTED" });

	await updateBadge();
	return "recording";
}

async function stopRecording(): Promise<void> {
	// Send stop to offscreen — the RECORDING_COMPLETE message will trigger upload
	await chrome.runtime.sendMessage({ type: "STOP_RECORDING" });
}

async function uploadRecording(base64: string, mimeType: string, durationSeconds: number) {
	try {
		await setRecordingState("uploading");
		await updateBadge();

		// Decode base64 to blob
		const binaryString = atob(base64);
		const bytes = new Uint8Array(binaryString.length);
		for (let i = 0; i < binaryString.length; i++) {
			bytes[i] = binaryString.charCodeAt(i);
		}
		const blob = new Blob([bytes], { type: mimeType });

		// Create session and upload audio through API
		const { sessionId } = await createSession();
		await uploadSession(sessionId, blob, durationSeconds);

		await setLastSessionId(sessionId);
		await setRecordingState("processing");
		await updateBadge();
	} catch (err: unknown) {
		const errorMessage = err instanceof Error ? err.message : "Upload failed";
		await setUploadError(errorMessage);
		await setRecordingState("error");
		await updateBadge();
	} finally {
		await closeOffscreenDocument();
	}
}

async function handleMeetClosed() {
	const recording = await getRecordingState();
	if (recording === "recording") {
		await stopRecording();
		// Upload will be triggered by RECORDING_COMPLETE message
	}
	await setMeetState({ onMeetTab: false, meetTabId: null });
	await updateBadge();
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
	if (message.type === "LOGIN") {
		auth
			.devLogin()
			.then((user) => sendResponse({ ok: true, user }))
			.catch((err: unknown) => {
				const errorMessage = err instanceof Error ? err.message : "Login failed";
				sendResponse({ ok: false, error: errorMessage });
			});
		return true;
	}

	if (message.type === "LOGOUT") {
		auth
			.logout()
			.then(() => sendResponse({ ok: true }))
			.catch(() => sendResponse({ ok: false }));
		return true;
	}

	if (message.type === "GET_STATE") {
		(async () => {
			const state = await getRecordingState();
			const meet = await getMeetState();
			const user = await auth.getUser();
			const lastSessionId = await getLastSessionId();
			const uploadError = await getUploadError();
			sendResponse({ state, onMeetTab: meet.onMeetTab, user, lastSessionId, uploadError });
		})();
		return true;
	}

	if (message.type === "START_RECORDING") {
		// Only handle from popup — offscreen document also receives this,
		// but it checks for streamId which popup messages don't have
		if (!message.streamId) {
			startRecording()
				.then((state) => sendResponse({ state }))
				.catch((err: unknown) => {
					const errorMessage = err instanceof Error ? err.message : "Failed to start";
					sendResponse({ state: "error", error: errorMessage });
				});
			return true;
		}
		return false; // Let offscreen handle it
	}

	if (message.type === "STOP_RECORDING") {
		// Only handle from popup (no base64 field)
		if (!message.base64) {
			stopRecording()
				.then(() => sendResponse({ ok: true }))
				.catch(() => sendResponse({ ok: false }));
			return true;
		}
		return false;
	}

	if (message.type === "RECORDING_COMPLETE") {
		uploadRecording(message.base64, message.mimeType, message.durationSeconds);
		return false;
	}

	if (message.type === "RESET_STATE") {
		(async () => {
			await setRecordingState("idle");
			await setLastSessionId(null);
			await setUploadError(null);
			await updateBadge();
			sendResponse({ ok: true });
		})();
		return true;
	}

	if (message.type === "MEET_PAGE_OPENED") {
		(async () => {
			const tabId = sender.tab?.id ?? null;
			await setMeetState({ onMeetTab: true, meetTabId: tabId });
			await updateBadge();
		})();
		return false;
	}

	if (message.type === "MEET_PAGE_CLOSED") {
		(async () => {
			await handleMeetClosed();
		})();
		return false;
	}
});

// If the Meet tab is closed entirely
chrome.tabs.onRemoved.addListener(async (tabId) => {
	const meet = await getMeetState();
	if (meet.meetTabId === tabId) {
		await handleMeetClosed();
	}
});

// If the Meet tab navigates away from meet.google.com
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo) => {
	if (changeInfo.url === undefined) return;
	const meet = await getMeetState();
	if (meet.meetTabId === tabId && !changeInfo.url.startsWith("https://meet.google.com")) {
		await handleMeetClosed();
	}
});

// Restore badge on service worker startup
updateBadge();
