export function isValidTimezone(tz: string): boolean {
	try {
		new Intl.DateTimeFormat("en-CA", { timeZone: tz });
		return true;
	} catch {
		return false;
	}
}

export function toLocalDay(instant: Date, timezone: string): string {
	return new Intl.DateTimeFormat("en-CA", {
		timeZone: timezone,
		year: "numeric",
		month: "2-digit",
		day: "2-digit"
	}).format(instant);
}

export function todayIn(timezone: string): string {
	return toLocalDay(new Date(), timezone);
}

export function dayNumber(day: string): number {
	const [y, m, d] = day.split("-").map(Number) as [number, number, number];
	return Date.UTC(y, m - 1, d) / 86_400_000;
}

export function daysBetween(a: string, b: string): number {
	return dayNumber(b) - dayNumber(a);
}