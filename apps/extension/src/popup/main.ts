import type { AuthUser } from "../lib/auth.js";
import type { RecordingState } from "../lib/state.js";

const authSection = document.getElementById("auth-section") as HTMLDivElement;
const userHeader = document.getElementById("user-header") as HTMLDivElement;
const userName = document.getElementById("user-name") as HTMLSpanElement;
const loginBtn = document.getElementById("login-btn") as HTMLButtonElement;
const logoutBtn = document.getElementById("logout-btn") as HTMLButtonElement;
const meetIndicator = document.getElementById("meet-indicator") as HTMLDivElement;
const statusEl = document.getElementById("status") as HTMLDivElement;
const errorMsg = document.getElementById("error-msg") as HTMLDivElement;
const reportLink = document.getElementById("report-link") as HTMLAnchorElement;
const toggleBtn = document.getElementById("toggle-btn") as HTMLButtonElement;
const resetBtn = document.getElementById("reset-btn") as HTMLButtonElement;

interface AppState {
	state: RecordingState;
	onMeetTab: boolean;
	user: AuthUser | null;
	lastSessionId: string | null;
	uploadError: string | null;
}

function showError(message: string) {
	errorMsg.textContent = message;
	errorMsg.hidden = false;
	statusEl.textContent = "Error";
	statusEl.className = "status error";
}

function updateUI(app: AppState) {
	const { state, onMeetTab, user, lastSessionId, uploadError } = app;

	// Auth state
	if (user) {
		authSection.hidden = true;
		userHeader.hidden = false;
		userName.textContent = user.name;
	} else {
		authSection.hidden = false;
		userHeader.hidden = true;
	}

	// Meet indicator
	meetIndicator.hidden = !onMeetTab;

	// Hide everything first
	errorMsg.hidden = true;
	reportLink.hidden = true;
	toggleBtn.hidden = true;
	resetBtn.hidden = true;

	// Status + actions per state
	statusEl.className = `status ${state}`;

	switch (state) {
		case "idle":
			statusEl.textContent = "Ready";
			if (user) {
				toggleBtn.hidden = false;
				toggleBtn.textContent = "Start Recording";
				toggleBtn.className = "btn idle";
			}
			break;

		case "recording":
			statusEl.textContent = "Recording...";
			toggleBtn.hidden = false;
			toggleBtn.textContent = "Stop Recording";
			toggleBtn.className = "btn recording";
			break;

		case "uploading":
			statusEl.textContent = "Uploading...";
			break;

		case "processing":
			statusEl.textContent = "Analysis in progress...";
			if (lastSessionId) {
				reportLink.href = `http://localhost:5173/sessions/${lastSessionId}`;
				reportLink.hidden = false;
			}
			resetBtn.hidden = false;
			break;

		case "error":
			statusEl.textContent = "Error";
			if (uploadError) {
				errorMsg.textContent = uploadError;
				errorMsg.hidden = false;
			}
			resetBtn.hidden = false;
			break;
	}
}

function refreshState() {
	chrome.runtime.sendMessage({ type: "GET_STATE" }, (response) => {
		if (response) {
			updateUI(response as AppState);
		}
	});
}

// Load current state on popup open
refreshState();

loginBtn.addEventListener("click", () => {
	loginBtn.disabled = true;
	loginBtn.textContent = "Signing in...";
	errorMsg.hidden = true;
	chrome.runtime.sendMessage({ type: "LOGIN" }, (response) => {
		loginBtn.disabled = false;
		loginBtn.textContent = "Dev Login";
		if (chrome.runtime.lastError) {
			showError(chrome.runtime.lastError.message ?? "Message failed");
			return;
		}
		if (response?.ok) {
			refreshState();
		} else {
			showError(response?.error ?? "Login failed — is the API running on localhost:3000?");
		}
	});
});

logoutBtn.addEventListener("click", () => {
	chrome.runtime.sendMessage({ type: "LOGOUT" }, () => {
		refreshState();
	});
});

toggleBtn.addEventListener("click", () => {
	const isRecording = toggleBtn.className.includes("recording");
	const msgType = isRecording ? "STOP_RECORDING" : "START_RECORDING";

	toggleBtn.disabled = true;
	errorMsg.hidden = true;

	chrome.runtime.sendMessage({ type: msgType }, (response) => {
		toggleBtn.disabled = false;
		if (chrome.runtime.lastError) {
			showError(chrome.runtime.lastError.message ?? "Message failed");
			return;
		}
		if (response?.error) {
			showError(response.error);
			return;
		}
		refreshState();
	});
});

resetBtn.addEventListener("click", () => {
	chrome.runtime.sendMessage({ type: "RESET_STATE" }, () => {
		refreshState();
	});
});
