import {
	type UsageResponse,
	completeRecording,
	createSession,
	getCanRecord,
	getUsage,
	listSessions,
	uploadChunk,
} from "../lib/api.js";
import * as auth from "../lib/auth.js";
import {
	type RecordingState,
	getLastSessionId,
	getMeetState,
	getRecordingStartedAt,
	getRecordingState,
	getUploadError,
	setLastSessionId,
	setMeetState,
	setRecordingStartedAt,
	setRecordingState,
	setUploadError,
} from "../lib/state.js";

const OFFSCREEN_URL = "src/offscreen/offscreen.html";

// Track the current recording session and in-flight chunk uploads
let activeSessionId: string | null = null;
const pendingUploads: Set<Promise<void>> = new Set();

// Usage cache (60s TTL)
let cachedUsage: UsageResponse | null = null;
let usageFetchedAt = 0;
const USAGE_CACHE_TTL = 60_000;

async function fetchUsageCached(forceRefresh = false): Promise<UsageResponse | null> {
	const now = Date.now();
	if (!forceRefresh && cachedUsage && now - usageFetchedAt < USAGE_CACHE_TTL) {
		return cachedUsage;
	}
	try {
		cachedUsage = await getUsage();
		usageFetchedAt = now;
		return cachedUsage;
	} catch {
		return cachedUsage; // return stale on error
	}
}

function invalidateUsageCache() {
	usageFetchedAt = 0;
}

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

	// Check if user can record (usage limit)
	const canRecord = await getCanRecord();
	if (!canRecord.allowed) {
		throw new Error(canRecord.reason ?? "Recording limit reached");
	}

	// Create session before recording starts so chunks can be uploaded immediately
	const { sessionId } = await createSession();
	activeSessionId = sessionId;
	await setLastSessionId(sessionId);

	await ensureOffscreenDocument();

	const response = await chrome.runtime.sendMessage({
		type: "START_RECORDING",
		source: "service-worker",
	});

	if (!response?.ok) {
		activeSessionId = null;
		throw new Error(response?.error ?? "Failed to start recording");
	}

	await setRecordingState("recording");
	await setRecordingStartedAt(Date.now());
	await setUploadError(null);

	// Notify content script
	chrome.tabs.sendMessage(meet.meetTabId, { type: "RECORDING_STARTED" });

	await updateBadge();
	return "recording";
}

async function stopRecording(): Promise<void> {
	// Send stop to offscreen — the RECORDING_STOPPED message will trigger finalization
	await chrome.runtime.sendMessage({ type: "STOP_RECORDING", source: "service-worker" });
}

function handleChunkReady(chunkIndex: number, base64: string, mimeType: string) {
	const sessionId = activeSessionId;
	if (!sessionId) {
		console.error("[sw] CHUNK_READY but no active session");
		return;
	}

	// Decode base64 to blob
	const binaryString = atob(base64);
	const bytes = new Uint8Array(binaryString.length);
	for (let i = 0; i < binaryString.length; i++) {
		bytes[i] = binaryString.charCodeAt(i);
	}
	const blob = new Blob([bytes], { type: mimeType });
	console.log(`[sw] Uploading chunk ${chunkIndex}: ${(blob.size / 1024).toFixed(1)} KB`);

	const uploadPromise = uploadChunk(sessionId, chunkIndex, blob)
		.then(() => {
			console.log(`[sw] Chunk ${chunkIndex} uploaded`);
		})
		.catch((err) => {
			console.error(`[sw] Chunk ${chunkIndex} upload failed:`, err);
			throw err;
		})
		.finally(() => {
			pendingUploads.delete(uploadPromise);
		});

	pendingUploads.add(uploadPromise);
}

async function handleRecordingStopped(totalChunks: number, durationSeconds: number) {
	const sessionId = activeSessionId;
	if (!sessionId) {
		console.error("[sw] RECORDING_STOPPED but no active session");
		return;
	}

	try {
		await setRecordingStartedAt(null);
		await setRecordingState("uploading");
		await updateBadge();

		// Wait for all in-flight chunk uploads to finish
		console.log(`[sw] Waiting for ${pendingUploads.size} pending uploads...`);
		await Promise.all([...pendingUploads]);
		console.log("[sw] All chunks uploaded");

		// Signal to the API that recording is complete
		await completeRecording(sessionId, totalChunks, durationSeconds);

		activeSessionId = null;
		invalidateUsageCache();
		await setRecordingState("processing");
		await updateBadge();

		// Notify content script so it can hide the recording indicator
		const meet = await getMeetState();
		if (meet.meetTabId != null) {
			chrome.tabs.sendMessage(meet.meetTabId, { type: "RECORDING_STOPPED" });
		}
	} catch (err: unknown) {
		const errorMessage = err instanceof Error ? err.message : "Upload failed";
		await setUploadError(errorMessage);
		await setRecordingState("error");
		await updateBadge();
	} finally {
		pendingUploads.clear();
		await closeOffscreenDocument();
	}
}

async function handleMeetClosed() {
	const recording = await getRecordingState();
	if (recording === "recording") {
		await stopRecording();
		// Upload will be triggered by RECORDING_STOPPED message
	}
	await setMeetState({ onMeetTab: false, meetTabId: null });
	await updateBadge();
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
	if (message.type === "LOGIN") {
		auth
			.login()
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
			const recordingStartedAt = await getRecordingStartedAt();

			let recentSessions: Awaited<ReturnType<typeof listSessions>> = [];
			let usage: UsageResponse | null = null;
			if (user) {
				try {
					recentSessions = await listSessions(3);
				} catch {
					// API unreachable — leave empty
				}
				usage = await fetchUsageCached();
			}

			sendResponse({
				state,
				onMeetTab: meet.onMeetTab,
				user,
				lastSessionId,
				uploadError,
				recordingStartedAt,
				recentSessions,
				usage,
			});
		})();
		return true;
	}

	if (message.type === "START_RECORDING") {
		// Only handle from side panel — offscreen document handles its own
		// START_RECORDING messages internally (source: "service-worker")
		if (message.source !== "service-worker") {
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
		// If from service-worker source, let offscreen handle it directly
		if (message.source === "service-worker") {
			return false;
		}
		// From side panel or content script — trigger stop
		stopRecording()
			.then(() => sendResponse({ ok: true }))
			.catch((err: unknown) => {
				const errorMessage = err instanceof Error ? err.message : "Failed to stop";
				sendResponse({ ok: false, error: errorMessage });
			});
		return true;
	}

	if (message.type === "CHUNK_READY") {
		handleChunkReady(message.chunkIndex, message.base64, message.mimeType);
		return false;
	}

	if (message.type === "RECORDING_STOPPED") {
		handleRecordingStopped(message.totalChunks, message.durationSeconds);
		return false;
	}

	if (message.type === "RESET_STATE") {
		(async () => {
			await setRecordingState("idle");
			await setLastSessionId(null);
			await setUploadError(null);
			activeSessionId = null;
			pendingUploads.clear();
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

// Open side panel when extension icon is clicked
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

// Restore badge on service worker startup
updateBadge();
