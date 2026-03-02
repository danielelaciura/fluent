let recorder: MediaRecorder | null = null;
let audioContext: AudioContext | null = null;
let chunks: Blob[] = [];
let startTime = 0;

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
	if (message.type === "PING") {
		sendResponse({ ok: true });
		return false;
	}

	if (message.type === "START_RECORDING") {
		startRecording(message.streamId)
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

async function startRecording(streamId: string) {
	// Capture tab audio (other participants) — needed for playback only
	const tabStream = await navigator.mediaDevices.getUserMedia({
		audio: {
			mandatory: {
				chromeMediaSource: "tab",
				chromeMediaSourceId: streamId,
			},
		} as unknown as MediaTrackConstraints,
	});

	// Capture microphone (user's own voice) — this is what we record
	const micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
	console.log(
		"[recorder] Mic:",
		micStream.getAudioTracks().map((t) => `${t.label} (${t.readyState})`),
	);

	// Set up AudioContext for tab audio playback
	audioContext = new AudioContext();
	if (audioContext.state !== "running") {
		await audioContext.resume();
	}

	// Play tab audio back so the user still hears the call (NOT recorded)
	const tabSource = audioContext.createMediaStreamSource(tabStream);
	tabSource.connect(audioContext.destination);

	chunks = [];
	startTime = Date.now();

	// Record ONLY the microphone — we want to analyze the user's English, not others'
	recorder = new MediaRecorder(micStream, {
		mimeType: "audio/webm;codecs=opus",
	});

	recorder.ondataavailable = (event) => {
		if (event.data.size > 0) {
			chunks.push(event.data);
		}
	};

	recorder.onstop = () => {
		const blob = new Blob(chunks, { type: "audio/webm;codecs=opus" });
		const durationSeconds = Math.round((Date.now() - startTime) / 1000);
		console.log(
			`[recorder] Stopped: ${chunks.length} chunks, ${(blob.size / 1024).toFixed(1)} KB, ${durationSeconds}s`,
		);

		const reader = new FileReader();
		reader.onloadend = () => {
			const base64 = (reader.result as string).split(",")[1];
			console.log(`[recorder] Sending base64: ${(base64.length / 1024).toFixed(1)} KB`);
			chrome.runtime.sendMessage({
				type: "RECORDING_COMPLETE",
				base64,
				mimeType: "audio/webm;codecs=opus",
				durationSeconds,
			});
		};
		reader.readAsDataURL(blob);

		// Clean up
		if (audioContext) {
			audioContext.close();
			audioContext = null;
		}
		for (const track of tabStream.getTracks()) {
			track.stop();
		}
		for (const track of micStream.getTracks()) {
			track.stop();
		}
	};

	// No timeslice — produces a single complete WebM blob on stop.
	// With timeslice, concatenated chunks can have broken seek cues
	// causing Whisper/ffmpeg to only decode the last cluster.
	recorder.start();
	console.log("[recorder] Recording mic only, AudioContext:", audioContext.state);
}

function stopRecording() {
	if (recorder && recorder.state !== "inactive") {
		recorder.stop();
	}
}
