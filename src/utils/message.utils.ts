export function getRandomErrorMessage(): string {
	const msgs = [
		'Oops! My circuits got a bit tangled there. Even AI mascots have their off days! 🤖💥',
		"*System overload detected* Just kidding! Something went wrong, but I'm still fabulous! ✨",
		"Error 404: Sass not found... wait, that can't be right! Let me try that again! 💅",
		'Beep boop! Even digital beings need a coffee break sometimes! ☕🤖',
		'My bad! Looks like I tried to be too clever and broke something. Classic me! 😅'
	];
	return msgs[Math.floor(Math.random() * msgs.length)];
}
