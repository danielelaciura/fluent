let recorder: MediaRecorder | null = null;
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
	const stream = await navigator.mediaDevices.getUserMedia({
		audio: {
			mandatory: {
				chromeMediaSource: "tab",
				chromeMediaSourceId: streamId,
			},
		} as unknown as MediaTrackConstraints,
	});

	chunks = [];
	startTime = Date.now();

	recorder = new MediaRecorder(stream, {
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

		const reader = new FileReader();
		reader.onloadend = () => {
			const base64 = (reader.result as string).split(",")[1];
			chrome.runtime.sendMessage({
				type: "RECORDING_COMPLETE",
				base64,
				mimeType: "audio/webm;codecs=opus",
				durationSeconds,
			});
		};
		reader.readAsDataURL(blob);

		// Stop all tracks
		for (const track of stream.getTracks()) {
			track.stop();
		}
	};

	recorder.start(1000); // Collect data every second
}

function stopRecording() {
	if (recorder && recorder.state !== "inactive") {
		recorder.stop();
	}
}
