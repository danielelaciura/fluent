let banner: HTMLDivElement | null = null;
let dismissTimer: ReturnType<typeof setTimeout> | null = null;

function showBanner() {
	if (banner) return;

	banner = document.createElement("div");
	banner.id = "meetfluent-banner";
	banner.textContent = "MeetFluent is ready — click the extension icon to start recording";
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
	});

	banner.addEventListener("click", hideBanner);
	document.body.appendChild(banner);

	dismissTimer = setTimeout(hideBanner, 5000);
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

// Notify service worker that we're on a Meet page
chrome.runtime.sendMessage({ type: "MEET_PAGE_OPENED" });
showBanner();

// Listen for recording start to hide banner
chrome.runtime.onMessage.addListener((message) => {
	if (message.type === "RECORDING_STARTED") {
		hideBanner();
	}
});

// Notify on page close
window.addEventListener("beforeunload", () => {
	chrome.runtime.sendMessage({ type: "MEET_PAGE_CLOSED" });
});
