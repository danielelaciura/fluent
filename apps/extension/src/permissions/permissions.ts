const btn = document.getElementById("grant-btn") as HTMLButtonElement;
const status = document.getElementById("status") as HTMLDivElement;

btn.addEventListener("click", async () => {
	btn.disabled = true;
	btn.textContent = "Requesting...";
	try {
		const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
		for (const track of stream.getTracks()) track.stop();
		status.textContent = "Microphone access granted. You can close this tab.";
		status.className = "status granted";
		btn.textContent = "Done";
	} catch {
		status.textContent = "Permission denied. Please allow microphone access and try again.";
		status.className = "status denied";
		btn.disabled = false;
		btn.textContent = "Try Again";
	}
});
