import { defineConfig } from "vite";
import webExtension from "vite-plugin-web-extension";

export default defineConfig({
	plugins: [
		webExtension({
			additionalInputs: ["src/offscreen/offscreen.html", "src/permissions/permissions.html"],
		}),
	],
	build: {
		outDir: "dist",
		emptyOutDir: true,
	},
});
