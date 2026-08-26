import { daysBetween } from "./days.js";

export interface Streaks {
	currentStreak: number;
	longestStreak: number;
}

export function computeStreaks(days: string[], today: string): Streaks {
	const unique = [...new Set(days)].sort();
	if (unique.length == 0) return { currentStreak: 0, longestStreak: 0 };

	let longest = 1;
	let run = 1;

	for (let i = 1; i < unique.length; i++) {
		if (daysBetween(unique[i - 1]!, unique[i]!) == 1) {
			run++;
			longest = Math.max(longest, run);
		} else {
			run = 1;
		}
	}

	let anchorIdx = -1;
	if (daysBetween(unique[unique.length - 1]!, today) === 0) {
		anchorIdx = unique.length - 1;
	} else if (unique.length >= 2 && daysBetween(unique[unique.length - 2]!, unique[unique.length - 1]!) === 1 && daysBetween(unique[unique.length - 1]!, today) === 1) {
		anchorIdx = unique.length - 1;
	}

	let current = 0;
	if (anchorIdx !== -1) {
		current = 1;
		for (let i = anchorIdx; i > 0; i--) {
			if (daysBetween(unique[i - 1]!, unique[i]!) === 1) current++;
			else break;
		}
	}
	return { currentStreak: current, longestStreak: Math.max(longest, current) };
}