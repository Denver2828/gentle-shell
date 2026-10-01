import { join } from "node:path";
import { getAgentDir, type ExtensionAPI, type ExtensionContext } from "@earendil-works/pi-coding-agent";
import { createNativeFullscreenInteraction } from "../lib/native-fullscreen-interaction.ts";
import { withOverlayRepaint } from "../lib/overlay-repaint.ts";
import { createStatsLoader, currentSessionStats, type StatsLoader } from "../lib/stats-collector.ts";
import { StatsView } from "../lib/stats-view.ts";

// Gentle Stats: /gentle:stats opens a full-terminal panel over local Pi
// session history (tokens, cost, models, activity). It only reads the
// session files Pi already writes; nothing new is persisted.

export const STATS_COMMAND_NAME = "gentle:stats";

/** Optional shortcut; there is no default key because the common alt+ keys are taken. */
export function statsViewKey(env: NodeJS.ProcessEnv = process.env): string | undefined {
	const value = env.GENTLE_PI_STATS_VIEW_KEY?.trim();
	return !value || value.toLowerCase() === "off" ? undefined : value;
}

export interface GentleStatsDeps {
	env?: NodeJS.ProcessEnv;
	now?: () => number;
	sessionsRoot?: () => string;
	loader?: StatsLoader;
}

export default function gentleStats(pi: ExtensionAPI, deps: GentleStatsDeps = {}): void {
	const env = deps.env ?? process.env;
	const now = deps.now ?? (() => Date.now());
	const sessionsRoot = deps.sessionsRoot ?? (() => join(getAgentDir(), "sessions"));
	// One loader per process keeps its per-file cache across openings.
	const loader = deps.loader ?? createStatsLoader();
	const overlays = new Set<StatsView>();

	const openOverlay = async (ctx: ExtensionContext) => {
		if (!ctx.hasUI) return;
		if (ctx.mode !== "tui") {
			ctx.ui.notify("The stats overlay requires TUI mode.", "warning");
			return;
		}
		let view: StatsView | undefined;
		await ctx.ui.custom<null>(
			(tui, theme, _keybindings, done) => {
				const close = withOverlayRepaint(tui, done);
				view = new StatsView({
					theme,
					rows: () => Math.max(0, tui.terminal.rows),
					cwd: ctx.sessionManager.getCwd(),
					now,
					load: () => loader.load(sessionsRoot()),
					current: () => currentSessionStats(ctx.sessionManager.getEntries(), { sessionId: ctx.sessionManager.getSessionId() ?? "", now: now() }),
					onClose: () => close(null),
					requestRender: () => tui.requestRender(),
				});
				overlays.add(view);
				// Open at once with a loading state; the scan repaints when it settles.
				void view.load();
				const interaction = createNativeFullscreenInteraction({
					keyboardTarget: view,
					requestRender: () => tui.requestRender(),
				});
				interaction.addChild(view);
				return interaction;
			},
			{ overlay: true, overlayOptions: { width: "100%", maxHeight: "100%", margin: 0, anchor: "center" } },
		).finally(() => {
			view?.dispose();
			if (view) overlays.delete(view);
		});
	};

	pi.registerCommand(STATS_COMMAND_NAME, {
		description: "Show local Pi usage stats: activity heatmap, tokens, cost, models, and this session. r cycles the range, s the project scope.",
		handler: async (_args, ctx) => openOverlay(ctx),
	});
	const viewKey = statsViewKey(env);
	if (viewKey) {
		pi.registerShortcut(viewKey as Parameters<ExtensionAPI["registerShortcut"]>[0], {
			description: "Show local Pi usage stats",
			handler: async (ctx) => openOverlay(ctx),
		});
	}
	pi.on("session_shutdown", () => {
		for (const view of overlays) { view.handleInput("q"); view.dispose(); }
		overlays.clear();
	});
}
