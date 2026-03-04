let recorder: MediaRecorder | null = null;
let micStream: MediaStream | null = null;
let chunkIndex = 0;
let startTime = 0;
let pendingChunks: Promise<void>[] = [];
let chunkTimer: ReturnType<typeof setTimeout> | null = null;
let isStopping = false;

const CHUNK_DURATION_MS = 0.2 * 60 * 1000; // 5 minutes

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
	if (message.type === "PING") {
		sendResponse({ ok: true });
		return false;
	}

	if (message.type === "START_RECORDING" && message.source === "service-worker") {
		startRecording()
			.then(() => sendResponse({ ok: true }))
			.catch((err: unknown) => {
				const errorMessage = err instanceof Error ? err.message : "Unknown error";
				sendResponse({ ok: false, error: errorMessage });
			});
		return true;
	}

	if (message.type === "STOP_RECORDING") {
		stopRecording();
		sendResponse({ ok: true });
		return false;
	}
});

function blobToBase64(blob: Blob): Promise<string> {
	return new Promise((resolve) => {
		const reader = new FileReader();
		reader.onloadend = () => {
			const base64 = (reader.result as string).split(",")[1];
			resolve(base64);
		};
		reader.readAsDataURL(blob);
	});
}

async function startRecording() {
	// Capture microphone (user's own voice) — this is what we record.
	// Tab audio (other participants) plays normally through the Meet tab
	// and does not need to be captured or re-routed.
	micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
	console.log(
		"[recorder] Mic:",
		micStream.getAudioTracks().map((t) => `${t.label} (${t.readyState})`),
	);

	chunkIndex = 0;
	startTime = Date.now();
	pendingChunks = [];
	isStopping = false;

	startNewChunkRecorder();
	console.log("[recorder] Recording mic only");
}

function startNewChunkRecorder() {
	if (!micStream || isStopping) return;

	const chunks: Blob[] = [];

	recorder = new MediaRecorder(micStream, {
		mimeType: "audio/webm;codecs=opus",
	});

	recorder.ondataavailable = (event) => {
		if (event.data.size > 0) {
			chunks.push(event.data);
		}
	};

	recorder.onstop = () => {
		if (chunks.length === 0) return;

		// Each stop produces a complete, self-contained WebM file
		const blob = new Blob(chunks, { type: "audio/webm;codecs=opus" });
		const currentIndex = chunkIndex++;
		console.log(`[recorder] Chunk ${currentIndex}: ${(blob.size / 1024).toFixed(1)} KB`);

		const chunkPromise = blobToBase64(blob).then((base64) => {
			chrome.runtime.sendMessage({
				type: "CHUNK_READY",
				chunkIndex: currentIndex,
				base64,
				mimeType: "audio/webm;codecs=opus",
			});
		});
		pendingChunks.push(chunkPromise);

		// If not stopping, start the next chunk recorder
		if (!isStopping) {
			startNewChunkRecorder();
		} else {
			// Final chunk sent — notify service worker
			finishRecording();
		}
	};

	// Start without timeslice — produces a single complete WebM on stop
	recorder.start();

	// Schedule stop after CHUNK_DURATION_MS to rotate to the next chunk
	chunkTimer = setTimeout(() => {
		if (recorder && recorder.state === "recording" && !isStopping) {
			recorder.stop();
		}
	}, CHUNK_DURATION_MS);
}

async function finishRecording() {
	const durationSeconds = Math.round((Date.now() - startTime) / 1000);
	const totalChunks = chunkIndex;

	// Wait for all chunk conversions to complete before signaling
	await Promise.all(pendingChunks);
	pendingChunks = [];

	console.log(`[recorder] Stopped: ${totalChunks} chunks, ${durationSeconds}s`);

	chrome.runtime.sendMessage({
		type: "RECORDING_STOPPED",
		totalChunks,
		durationSeconds,
	});

	// Clean up mic stream
	if (micStream) {
		for (const track of micStream.getTracks()) {
			track.stop();
		}
		micStream = null;
	}
}

function stopRecording() {
	if (isStopping) return;
	isStopping = true;

	if (chunkTimer) {
		clearTimeout(chunkTimer);
		chunkTimer = null;
	}

	if (recorder && recorder.state !== "inactive") {
		// Stop triggers ondataavailable + onstop, which calls finishRecording
		recorder.stop();
	} else {
		// No active recorder — finish immediately
		finishRecording();
	}
}
