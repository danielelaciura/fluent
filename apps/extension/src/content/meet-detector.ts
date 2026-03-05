let banner: HTMLDivElement | null = null;
let indicator: HTMLDivElement | null = null;
let dismissTimer: ReturnType<typeof setTimeout> | null = null;

const BANNER_DEFAULT_TEXT = "Zest is ready — click here to start recording";

function safeSendMessage(message: Record<string, string>) {
	try {
		chrome.runtime.sendMessage(message);
	} catch {
		// Extension context invalidated (extension was reloaded) — ignore
	}
}

function showBanner() {
	if (banner) return;

	banner = document.createElement("div");
	banner.id = "meetfluent-banner";
	banner.textContent = BANNER_DEFAULT_TEXT;
	Object.assign(banner.style, {
		position: "fixed",
		top: "0",
		left: "0",
		right: "0",
		zIndex: "10000",
		background: "#1e293b",
		color: "#f1f5f9",
		padding: "10px 16px",
		fontSize: "13px",
		fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
		textAlign: "center",
		cursor: "pointer",
		borderBottom: "2px solid #3b82f6",
		transition: "opacity 0.2s",
	});

	banner.addEventListener("click", handleBannerClick);
	document.body.appendChild(banner);

	dismissTimer = setTimeout(hideBanner, 8000);
}

async function handleBannerClick() {
	if (!banner) return;

	// Prevent double-clicks
	banner.style.pointerEvents = "none";
	banner.textContent = "Starting recording…";

	try {
		const response = await chrome.runtime.sendMessage({ type: "START_RECORDING" });

		if (response?.state === "recording") {
			hideBanner();
			showRecordingIndicator();
		} else {
			showBannerError(response?.error ?? "Failed to start recording");
		}
	} catch {
		showBannerError("Extension error — try reloading the page");
	}
}

function showBannerError(message: string) {
	if (!banner) return;

	banner.textContent = message;
	banner.style.borderBottom = "2px solid #ef4444";
	banner.style.pointerEvents = "auto";

	setTimeout(() => {
		if (!banner) return;
		banner.textContent = BANNER_DEFAULT_TEXT;
		banner.style.borderBottom = "2px solid #3b82f6";
	}, 3000);
}

function hideBanner() {
	if (dismissTimer) {
		clearTimeout(dismissTimer);
		dismissTimer = null;
	}
	if (banner) {
		banner.remove();
		banner = null;
	}
}

function showRecordingIndicator() {
	if (indicator) return;

	indicator = document.createElement("div");
	indicator.id = "meetfluent-recording-indicator";

	// Pulsing dot
	const dot = document.createElement("span");
	Object.assign(dot.style, {
		display: "inline-block",
		width: "8px",
		height: "8px",
		borderRadius: "50%",
		background: "#ef4444",
		marginRight: "8px",
		animation: "meetfluent-pulse 1.5s ease-in-out infinite",
	});

	const label = document.createElement("span");
	label.textContent = "Zest recording";

	indicator.appendChild(dot);
	indicator.appendChild(label);

	Object.assign(indicator.style, {
		position: "fixed",
		top: "12px",
		right: "12px",
		zIndex: "10000",
		background: "#cdf1a4",
		color: "#1e293b",
		padding: "6px 14px",
		fontSize: "12px",
		fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
		borderRadius: "20px",
		cursor: "pointer",
		display: "flex",
		alignItems: "center",
		backdropFilter: "blur(4px)",
		boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
		userSelect: "none",
	});

	// Add keyframe animation
	const style = document.createElement("style");
	style.textContent = `
		@keyframes meetfluent-pulse {
			0%, 100% { opacity: 1; }
			50% { opacity: 0.3; }
		}
	`;
	indicator.appendChild(style);

	indicator.addEventListener("click", handleIndicatorClick);
	document.body.appendChild(indicator);
}

async function handleIndicatorClick() {
	if (!indicator) return;
	indicator.style.pointerEvents = "none";

	try {
		await chrome.runtime.sendMessage({ type: "STOP_RECORDING" });
	} catch {
		// Extension context invalidated — ignore
	}
	hideRecordingIndicator();
}

function hideRecordingIndicator() {
	if (indicator) {
		indicator.remove();
		indicator = null;
	}
}

// Notify service worker that we're on a Meet page
safeSendMessage({ type: "MEET_PAGE_OPENED" });
showBanner();

// Listen for recording state changes
try {
	chrome.runtime.onMessage.addListener((message) => {
		if (message.type === "RECORDING_STARTED") {
			hideBanner();
			showRecordingIndicator();
		}
		if (message.type === "RECORDING_STOPPED") {
			hideRecordingIndicator();
		}
	});
} catch {
	// Extension context invalidated — ignore
}

// Notify on page close
window.addEventListener("beforeunload", () => {
	safeSendMessage({ type: "MEET_PAGE_CLOSED" });
});
