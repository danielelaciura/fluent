import { getSession, type RecentSession } from "../lib/api.js";
import type { AuthUser } from "../lib/auth.js";
import type { RecordingState } from "../lib/state.js";

// ─── DOM refs ────────────────────────────────────────
const headerUser = document.getElementById("header-user") as HTMLDivElement;
const userName = document.getElementById("user-name") as HTMLSpanElement;
const logoutBtn = document.getElementById("logout-btn") as HTMLButtonElement;

const sectionLogin = document.getElementById("section-login") as HTMLElement;
const loginBtn = document.getElementById("login-btn") as HTMLButtonElement;
const loginError = document.getElementById("login-error") as HTMLParagraphElement;

const sectionIdle = document.getElementById("section-idle") as HTMLElement;
const micBanner = document.getElementById("mic-banner") as HTMLDivElement;
const micSetupLink = document.getElementById("mic-setup-link") as HTMLAnchorElement;
const meetDot = document.getElementById("meet-dot") as HTMLSpanElement;
const startBtn = document.getElementById("start-btn") as HTMLButtonElement;
const idleError = document.getElementById("idle-error") as HTMLParagraphElement;

const sectionRecording = document.getElementById("section-recording") as HTMLElement;
const timerEl = document.getElementById("timer") as HTMLDivElement;
const stopBtn = document.getElementById("stop-btn") as HTMLButtonElement;

const sectionUploading = document.getElementById("section-uploading") as HTMLElement;

const sectionProcessing = document.getElementById("section-processing") as HTMLElement;
const reportLink = document.getElementById("report-link") as HTMLAnchorElement;
const resetBtnProcessing = document.getElementById("reset-btn-processing") as HTMLButtonElement;

const sectionError = document.getElementById("section-error") as HTMLElement;
const errorMessage = document.getElementById("error-message") as HTMLParagraphElement;
const resetBtnError = document.getElementById("reset-btn-error") as HTMLButtonElement;

const sectionLoading = document.getElementById("section-loading") as HTMLElement;
const sectionSessions = document.getElementById("section-sessions") as HTMLElement;
const sessionsList = document.getElementById("sessions-list") as HTMLDivElement;

// ─── State ───────────────────────────────────────────
interface AppState {
	state: RecordingState;
	onMeetTab: boolean;
	user: AuthUser | null;
	lastSessionId: string | null;
	uploadError: string | null;
	recordingStartedAt: number | null;
	recentSessions: RecentSession[];
}

let timerInterval: ReturnType<typeof setInterval> | null = null;
let pollInterval: ReturnType<typeof setInterval> | null = null;

// ─── Timer ───────────────────────────────────────────
function formatTime(totalSeconds: number): string {
	const m = Math.floor(totalSeconds / 60);
	const s = totalSeconds % 60;
	return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function startTimer(startedAt: number) {
	stopTimer();
	const tick = () => {
		const elapsed = Math.floor((Date.now() - startedAt) / 1000);
		timerEl.textContent = formatTime(elapsed);
	};
	tick();
	timerInterval = setInterval(tick, 1000);
}

function stopTimer() {
	if (timerInterval !== null) {
		clearInterval(timerInterval);
		timerInterval = null;
	}
}

// ─── Processing poll ─────────────────────────────────
function startProcessingPoll(sessionId: string) {
	stopProcessingPoll();
	pollInterval = setInterval(async () => {
		try {
			const session = await getSession(sessionId);
			if (session.status === "complete" || session.status === "error") {
				stopProcessingPoll();
				chrome.runtime.sendMessage({ type: "RESET_STATE" });
			}
		} catch {
			// API unreachable — keep polling
		}
	}, 5000);
}

function stopProcessingPoll() {
	if (pollInterval !== null) {
		clearInterval(pollInterval);
		pollInterval = null;
	}
}

// ─── Sections ────────────────────────────────────────
const allSections = [
	sectionLoading,
	sectionLogin,
	sectionIdle,
	sectionRecording,
	sectionUploading,
	sectionProcessing,
	sectionError,
];

function showSection(section: HTMLElement) {
	for (const s of allSections) {
		s.hidden = true;
	}
	section.hidden = false;
}

// ─── Sessions rendering ─────────────────────────────
function formatDate(iso: string): string {
	const d = new Date(iso);
	return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatDuration(seconds: number | null): string {
	if (seconds == null) return "";
	if (seconds < 60) return `${seconds}s`;
	return `${Math.floor(seconds / 60)}m`;
}

function renderSessions(sessions: RecentSession[]) {
	if (sessions.length === 0) {
		sectionSessions.hidden = true;
		return;
	}

	sectionSessions.hidden = false;
	sessionsList.innerHTML = "";

	for (const s of sessions) {
		const card = document.createElement("a");
		card.className = "session-card";
		card.href = `http://localhost:5173/sessions/${s.id}`;
		card.target = "_blank";

		const left = document.createElement("div");
		left.className = "session-left";

		const dateEl = document.createElement("span");
		dateEl.className = "session-date";
		dateEl.textContent = formatDate(s.createdAt);
		left.appendChild(dateEl);

		if (s.durationSeconds != null) {
			const durEl = document.createElement("span");
			durEl.className = "session-duration";
			durEl.textContent = formatDuration(s.durationSeconds);
			left.appendChild(durEl);
			
			const link = document.createElement("div") ;
			link.className = "link";
			link.textContent = card.href;
			left.appendChild(link);
		}

		const right = document.createElement("div");
		right.className = "session-right";

		if (s.overallScore != null && s.cefrLevel != null) {
			const scoreEl = document.createElement("span");
			scoreEl.className = "session-score";
			scoreEl.textContent = String(s.overallScore);
			right.appendChild(scoreEl);

			const badgeEl = document.createElement("span");
			badgeEl.className = "session-badge";
			badgeEl.textContent = s.cefrLevel;
			right.appendChild(badgeEl);
		} else {
			const statusBadge = document.createElement("span");
			statusBadge.className = "session-status-badge";
			statusBadge.textContent = s.status;
			right.appendChild(statusBadge);
		}

		card.appendChild(left);
		card.appendChild(right);
		sessionsList.appendChild(card);
	}
}

// ─── UI update ───────────────────────────────────────
function updateUI(app: AppState) {
	const { state, onMeetTab, user, lastSessionId, uploadError, recordingStartedAt, recentSessions } =
		app;

	// Header user
	if (user) {
		headerUser.hidden = false;
		const displayName =
			user.firstName || user.lastName
				? `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim()
				: user.email;
		userName.textContent = displayName;
	} else {
		headerUser.hidden = true;
	}

	// Stop timer and poll by default (restart only when needed)
	stopTimer();
	stopProcessingPoll();

	// State section
	if (!user) {
		showSection(sectionLogin);
		sectionSessions.hidden = true;
		return;
	}

	switch (state) {
		case "idle":
			showSection(sectionIdle);
			meetDot.hidden = !onMeetTab;
			checkMicPermission();
			renderSessions(recentSessions);
			break;

		case "recording":
			showSection(sectionRecording);
			stopBtn.disabled = false;
			if (recordingStartedAt) {
				startTimer(recordingStartedAt);
			}
			sectionSessions.hidden = true;
			break;

		case "uploading":
			showSection(sectionUploading);
			sectionSessions.hidden = true;
			break;

		case "processing":
			showSection(sectionProcessing);
			if (lastSessionId) {
				reportLink.href = `http://localhost:5173/sessions/${lastSessionId}`;
				reportLink.hidden = false;
				startProcessingPoll(lastSessionId);
			} else {
				reportLink.hidden = true;
			}
			renderSessions(recentSessions);
			break;

		case "error":
			showSection(sectionError);
			errorMessage.textContent = uploadError ?? "Something went wrong";
			renderSessions(recentSessions);
			break;
	}
}

// ─── State fetch ─────────────────────────────────────
function refreshState() {
	chrome.runtime.sendMessage({ type: "GET_STATE" }, (response) => {
		if (response) {
			updateUI(response as AppState);
		}
	});
}

// ─── Event listeners ─────────────────────────────────
loginBtn.addEventListener("click", () => {
	loginBtn.disabled = true;
	loginBtn.textContent = "Signing in...";
	loginError.hidden = true;

	chrome.runtime.sendMessage({ type: "LOGIN" }, (response) => {
		loginBtn.disabled = false;
		loginBtn.textContent = "Sign in with Google";

		if (chrome.runtime.lastError) {
			loginError.textContent = chrome.runtime.lastError.message ?? "Connection failed";
			loginError.hidden = false;
			setTimeout(() => {
				loginError.hidden = true;
			}, 3000);
			return;
		}

		if (response?.ok) {
			refreshState();
		} else {
			loginError.textContent = response?.error ?? "Login failed — is the API running?";
			loginError.hidden = false;
			setTimeout(() => {
				loginError.hidden = true;
			}, 3000);
		}
	});
});

logoutBtn.addEventListener("click", () => {
	chrome.runtime.sendMessage({ type: "LOGOUT" }, () => {
		refreshState();
	});
});

startBtn.addEventListener("click", () => {
	startBtn.disabled = true;

	chrome.runtime.sendMessage({ type: "START_RECORDING" }, (response) => {
		startBtn.disabled = false;
		if (response?.error) {
			idleError.textContent = response.error;
			idleError.hidden = false;
			setTimeout(() => {
				idleError.hidden = true;
			}, 3000);
			return;
		}
		refreshState();
	});
});

stopBtn.addEventListener("click", () => {
	stopBtn.disabled = true;
	chrome.runtime.sendMessage({ type: "STOP_RECORDING" });
	// UI will update automatically via storage.onChanged when state transitions
});

resetBtnProcessing.addEventListener("click", () => {
	chrome.runtime.sendMessage({ type: "RESET_STATE" }, () => {
		refreshState();
	});
});

resetBtnError.addEventListener("click", () => {
	chrome.runtime.sendMessage({ type: "RESET_STATE" }, () => {
		refreshState();
	});
});

// ─── Mic permission ──────────────────────────────────
async function checkMicPermission() {
	try {
		const result = await navigator.permissions.query({ name: "microphone" as PermissionName });
		micBanner.hidden = result.state === "granted";
	} catch {
		// permissions.query not supported — hide the banner
		micBanner.hidden = true;
	}
}

micSetupLink.addEventListener("click", (e) => {
	e.preventDefault();
	chrome.tabs.create({ url: chrome.runtime.getURL("src/permissions/permissions.html") });
});

// ─── React to background state changes ───────────────
chrome.storage.local.onChanged.addListener(() => {
	refreshState();
});

// ─── Init ────────────────────────────────────────────
refreshState();
