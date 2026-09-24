<script lang="ts">
	const messages = [
		{ avatar: 'priya', body: "My VPN keeps disconnecting every few minutes. I can't access internal tools...", channel: '#it-support', id: 1, name: 'Priya Desai', time: '10:24 AM' },
		{ avatar: 'daniel', body: 'Can I get access to the Figma Pro plan for our design team?', channel: '#it-support', id: 2, name: 'Daniel Kim', time: '9:56 AM' },
		{ avatar: 'marcus', body: "My laptop is running very slow since today's update. Any ideas?", channel: '#general', id: 3, name: 'Marcus Lee', time: '9:41 AM' },
		{ avatar: 'emily', body: "I'm getting an error when trying to access the production environment.", channel: '#it-support', id: 4, name: 'Emily Carter', time: '9:12 AM' },
		{ avatar: 'alex', body: 'Requesting additional Slack channels for the new project.', channel: '#engineering', id: 5, name: 'Alex Rivera', time: '8:50 AM' },
		{ avatar: 'sarah', body: 'My monitor stopped working after the latest macOS update.', channel: '#it-support', id: 6, name: 'Sarah Wong', time: '8:33 AM' },
		{ avatar: 'james', body: 'Can someone help me reset my Okta password?', channel: '#hr', id: 7, name: 'James Park', time: '7:18 AM' },
		{ avatar: 'olivia', body: "I'm traveling next week — do I need a VPN for international travel?", channel: '#it-support', id: 8, name: 'Olivia Martin', time: '6:42 AM' }
	];

	const initialConversation = [
		{ avatar: 'priya', body: "My VPN keeps disconnecting every few minutes. I can't access internal tools and it's blocking my work. 🙂\n\nThis started this morning. Anyone else seeing this?", name: 'Priya Desai', time: '10:24 AM' },
		{ avatar: 'alex', body: 'I’m having the same issue. Seems to have started after the latest update.', name: 'Alex Rivera', time: '10:26 AM' },
		{ avatar: 'priya', body: "Good to know it's not just me. Let me know if there's a fix!", name: 'Priya Desai', time: '10:27 AM' },
		{ avatar: 'bot', body: "👋 I've detected a potential IT issue and am analyzing this message...\n\nThis may be related to VPN connectivity issues. I'll create a ticket shortly.", isBot: true, name: 'HelpDesk AI', time: '10:27 AM' }
	];

	const metrics = [
		{ detail: 'Sample integration data', icon: '▥', label: 'Webhook Preview', tone: 'brand', value: 'Sample' },
		{ change: '↑ 24%', detail: 'in the last 24 hours', icon: 'ϟ', label: 'Messages Processed', tone: 'brand', value: '127' },
		{ change: '↑ 4%', detail: 'vs. previous 7 days', icon: '◎', label: 'Auto-triage Accuracy', tone: 'brand', value: '92%' },
		{ change: '↓ 62%', detail: 'vs. manual intake', icon: '◷', label: 'Average Triage Time', tone: 'brand', value: '8s' }
	];

	const responseText = "Hi Priya,\nThanks for reporting this VPN issue. Our sample support team will investigate it. This is a suggested draft, not a sent reply.";

	let selectedChannel = $state('All channels');
	let selectedId = $state(1);
	let replyDraft = $state('');
	let ticketCreated = $state(false);
	let replyNotice = $state('');
	let visibleMessages = $derived(selectedChannel === 'All channels' ? messages : messages.filter((message) => message.channel === selectedChannel));
	let activeMessage = $derived(visibleMessages.find((message) => message.id === selectedId) ?? visibleMessages[0]);
	let conversation = $derived(activeMessage.id === 1 ? initialConversation : [
		{ avatar: activeMessage.avatar, body: activeMessage.body, name: activeMessage.name, time: activeMessage.time },
		{ avatar: 'bot', body: 'Thanks for flagging this. I’m checking the details and will help route this to the right team.', isBot: true, name: 'HelpDesk AI', time: activeMessage.time }
	]);
</script>

<svelte:head>
	<title>Slack Intake | HelpDesk AI</title>
	<meta name="description" content="Review and triage support requests from Slack." />
</svelte:head>

<main id="main-content" class="dashboard">
	<div class="page-heading ui-page-heading"><div><h1>Slack Intake</h1><p>Sample messages and triage. Replies and tickets stay in this preview; no Slack connection.</p></div><a class="settings-button ui-button" href="/settings/slack"><span aria-hidden="true">⚙</span> Slack Settings</a></div>

	<section class="metric-grid" aria-label="Slack intake metrics">
		{#each metrics as metric}
			<article class="metric-card ui-metric-card {metric.tone}"><div class="metric-icon ui-metric-icon" aria-hidden="true">{metric.icon}</div><div class="metric-content"><p>{metric.label}</p><div class="metric-value tabular-nums">{metric.value}{#if metric.change}<span>{metric.change}</span>{/if}</div><small class="metric-caption">{metric.detail}</small></div></article>
		{/each}
	</section>

	<div class="intake-grid">
		<section class="panel ui-panel inbox-panel">
			<div class="inbox-heading"><h2>Incoming Messages</h2><span class="live-pill ui-badge">Sample</span><label class="channel-select"><select class="ui-field" aria-label="Filter messages by channel" bind:value={selectedChannel} onchange={() => { replyDraft = ''; replyNotice = ''; ticketCreated = false; }}><option>All channels</option><option>#it-support</option><option>#general</option><option>#engineering</option><option>#hr</option></select></label></div>
			<div class="message-list">
				{#each visibleMessages as message (message.id)}
					<button type="button" class="message-row" aria-pressed={activeMessage.id === message.id} class:selected={activeMessage.id === message.id} onclick={() => { selectedId = message.id; ticketCreated = false; replyDraft = ''; replyNotice = ''; }}>
						<span class="avatar person {message.avatar}" aria-hidden="true"></span><span class="message-copy"><span class="message-meta"><strong>{message.name}</strong><span>{message.channel}</span><time class="tabular-nums">{message.time}</time></span><span class="message-preview">{message.body}</span></span>{#if message.id !== 3}<i class="unread-dot" aria-hidden="true"></i><span class="sr-only">Unread message</span>{/if}
					</button>
				{/each}
			</div>
		</section>

		<section class="panel ui-panel thread-panel" aria-label="Selected Slack conversation">
			<div class="thread-heading"><span class="avatar person {activeMessage.avatar}" aria-hidden="true"></span><div><h2>{activeMessage.name}</h2><p>{activeMessage.channel}<br />Today, <span class="tabular-nums">{activeMessage.time}</span></p></div></div>
			<div class="conversation">
				{#each conversation as item}
					<div class="chat-message" class:ai-message={item.isBot}><span class="avatar person {item.avatar}" aria-hidden="true"></span><div class="chat-copy"><div class="chat-meta"><strong>{item.name}</strong>{#if item.isBot}<span class="app-badge ui-badge">APP</span>{/if}<time class="tabular-nums">{item.time}</time></div><div class="chat-bubble">{item.body}</div></div></div>
				{/each}
			</div>
			<form class="reply-box" onsubmit={(event) => { event.preventDefault(); if (replyDraft.trim()) { replyNotice = 'Reply remains in this local preview. Nothing was sent to Slack.'; } }}>
				<textarea bind:value={replyDraft} aria-label="Draft reply for {activeMessage.name}" placeholder="Draft a reply in this preview..."></textarea>
				<div class="reply-actions"><span aria-hidden="true">☻</span><span aria-hidden="true">@</span><span aria-hidden="true">♧</span><span></span><button class="send-button" type="submit" disabled={!replyDraft.trim()} aria-label="Preview reply">➤</button></div>
				<small class="reply-status" role="status">{replyNotice}</small>
			</form>
		</section>

		<aside class="triage-column">
			<section class="panel ui-panel analysis-panel">
				<div class="analysis-heading"><div><h2>Sample Triage Analysis</h2><p>Example for VPN conversation only</p></div>{#if activeMessage.id === 1}<span class="confidence-pill ui-badge ui-badge-success">✣&nbsp; Sample confidence</span>{/if}</div>
				{#if activeMessage.id === 1}
				<div class="analysis-row"><span class="analysis-icon blue" aria-hidden="true">⚙</span><span class="analysis-label">Detected Category</span><span class="analysis-value"><strong>{selectedId === 1 ? 'Technical Issue' : 'Support Request'}</strong><small>{selectedId === 1 ? 'VPN / Network Access' : activeMessage.channel}</small></span></div>
				<div class="analysis-row"><span class="analysis-icon red" aria-hidden="true">↑</span><span class="analysis-label">Priority</span><span class="analysis-value"><strong class="priority-tag ui-badge ui-badge-danger">High</strong><small>Blocking work for multiple users</small></span></div>
				<div class="analysis-row urgency-row"><span class="analysis-icon amber" aria-hidden="true">☻</span><span class="analysis-label">Sentiment /<br />Urgency</span><span class="analysis-value"><strong>Frustrated</strong><small>High urgency (keywords: can't access, blocking)</small></span></div>
				<div class="analysis-row"><span class="analysis-icon blue" aria-hidden="true">♙</span><span class="analysis-label">Suggested<br />Assignee</span><span class="analysis-value"><strong class="assignee-name"><i class="avatar mini alex" aria-hidden="true"></i> Alex Rivera</strong><small>IT Infrastructure Team</small></span></div>
				<div class="analysis-row incidents-row"><span class="analysis-icon blue" aria-hidden="true">▤</span><span class="analysis-label">Similar Incidents</span><span class="analysis-value"><strong>3 similar tickets found</strong><small>VPN disconnecting after update<br />Network access issues<br />Cannot connect to VPN (macOS)</small></span></div>
				<div class="suggested-response"><div class="response-heading"><span class="analysis-icon blue" aria-hidden="true">▤</span><strong>Suggested Response</strong><button class="ui-button ui-button-quiet" type="button" onclick={() => { replyDraft = responseText; replyNotice = ''; }}>◉&nbsp; Use sample draft</button></div><p>Hi {activeMessage.name.split(' ')[0]},<br />Thanks for reporting this VPN issue. Our sample support team will investigate it. This is a suggested draft, not a sent reply.<br /><span>— HelpDesk AI preview</span></p></div>
				{:else}<p>Sample triage details are available for the VPN conversation only. Review this message before drafting a response.</p>{/if}
			</section>
			<section class="panel ui-panel create-panel"><div class="create-heading"><span class="create-icon" aria-hidden="true">▤</span><div><h2>Ticket Preview</h2><p>{ticketCreated ? 'Ticket preview prepared locally; no ticket was created.' : 'Review sample details before creating a real ticket.'}</p></div></div><div class="ticket-preview"><strong>{activeMessage.id === 1 ? 'VPN keeps disconnecting' : activeMessage.body}</strong>{#if activeMessage.id === 1}<div><span class="priority-tag ui-badge ui-badge-danger">◆&nbsp; High</span><span class="category-tag ui-badge">▤&nbsp; Technical Issue</span><span class="assignee-tag ui-badge"><i class="avatar mini alex" aria-hidden="true"></i> Alex Rivera</span></div>{/if}</div><button type="button" class="create-button ui-button ui-button-primary" onclick={() => { ticketCreated = true; }}><span aria-hidden="true">✧</span>Preview ticket</button></section>
		</aside>
	</div>
</main>

<style>
	.dashboard { min-width: 0; overflow: auto; padding: 14px 23px 22px; }
	.page-heading { margin: 0 0 17px; padding: 0 7px; }
	.settings-button { white-space: nowrap; }
	.settings-button span { font-size: 19px; }

	.metric-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin: 0 7px 16px; }
	.metric-card { min-height: 104px; }
	.metric-card.success { --icon-bg: var(--ui-success-soft); --icon-color: var(--ui-success); }
	.metric-card.brand { --icon-bg: var(--ui-primary-soft); --icon-color: var(--ui-primary); }
	.metric-card.danger { --icon-bg: var(--ui-danger-soft); --icon-color: var(--ui-danger); }
	.metric-icon { background: var(--icon-bg); color: var(--icon-color); }
	.metric-content { min-width: 0; padding-top: 3px; }
	.metric-content p { margin: 0 0 4px; color: var(--ui-muted); font-size: 13px; white-space: nowrap; }
	.metric-card.success .metric-content p { display: inline-block; padding: 1px 6px; border-radius: 4px; background: var(--ui-success-soft); }
	.metric-value { display: flex; align-items: center; gap: 14px; color: var(--ui-text); font-size: 27px; font-weight: 700; line-height: 1.15; letter-spacing: -.5px; white-space: nowrap; }
	.metric-card.success .metric-value { color: var(--ui-success); font-size: 22px; }
	.metric-value span { color: var(--ui-success); font-size: 14px; font-weight: 600; letter-spacing: 0; }
	.metric-caption { display: block; margin-top: 4px; color: var(--ui-muted); font-size: 12px; white-space: nowrap; }

	.intake-grid { display: grid; grid-template-columns: minmax(315px, 1.02fr) minmax(320px, .96fr) minmax(345px, 1.05fr); align-items: stretch; gap: 12px; min-height: 0; }
	.inbox-panel, .thread-panel { min-height: 778px; }
	.inbox-panel { overflow: hidden; }
	.inbox-heading { display: flex; align-items: center; gap: 12px; height: 54px; padding: 0 13px; border-bottom: 1px solid var(--ui-border); }
	.inbox-heading h2 { margin: 0 auto 0 0; font-size: 16px; letter-spacing: -.2px; white-space: nowrap; }
	.channel-select { position: relative; }
	.channel-select select { appearance: none; max-width: 116px; padding-right: 28px; font-size: 12px; cursor: pointer; }
	.channel-select::after { position: absolute; top: 6px; right: 10px; color: var(--ui-muted); font-size: 16px; content: '⌄'; pointer-events: none; }
	.message-list { overflow-y: auto; max-height: 722px; }
	.message-row { position: relative; display: flex; align-items: flex-start; gap: 16px; width: 100%; min-height: 86px; padding: 13px 14px 11px; border: 0; border-bottom: 1px solid var(--ui-border); background: var(--ui-surface); text-align: left; cursor: pointer; }
	.message-row:hover { background: var(--ui-surface-subtle); }
	.message-row.selected { border-left: 2px solid var(--ui-primary); border-radius: var(--ui-radius-sm); background: var(--ui-primary-soft); }
	.person { width: 52px; height: 52px; font-size: 0; background-color: #e5d4cc; box-shadow: inset 0 0 0 1px #ffffff75; }
	.person.daniel, .mini.daniel { background-image: radial-gradient(ellipse at 51% 39%, #c98b66 0 18%, transparent 19%), radial-gradient(ellipse at 50% 29%, #282526 0 31%, transparent 32%), radial-gradient(ellipse at 50% 102%, #274d66 0 42%, transparent 43%), linear-gradient(135deg, #e7d5c9, #a7bdc6); }
	.person.marcus { background-image: radial-gradient(ellipse at 51% 39%, #9b5c3e 0 18%, transparent 19%), radial-gradient(ellipse at 50% 29%, #221e1c 0 33%, transparent 34%), radial-gradient(ellipse at 50% 102%, #2c584c 0 42%, transparent 43%), linear-gradient(135deg, #d8c5b7, #829f9a); }
	.person.emily, .mini.emily { background-image: radial-gradient(ellipse at 51% 39%, #efb99d 0 18%, transparent 19%), radial-gradient(ellipse at 50% 29%, #684a37 0 31%, transparent 32%), radial-gradient(ellipse at 50% 102%, #a3b8a9 0 42%, transparent 43%), linear-gradient(135deg, #f0d9c8, #b3c6c6); }
	.person.alex, .mini.alex { background-image: radial-gradient(ellipse at 51% 39%, #a86848 0 18%, transparent 19%), radial-gradient(ellipse at 50% 29%, #211c1b 0 32%, transparent 33%), radial-gradient(ellipse at 50% 102%, #203d3b 0 42%, transparent 43%), linear-gradient(135deg, #d6c6b8, #738c8a); }
	.person.sarah { background-image: radial-gradient(ellipse at 51% 39%, #e7b393 0 18%, transparent 19%), radial-gradient(ellipse at 50% 29%, #1e1c1e 0 31%, transparent 32%), radial-gradient(ellipse at 50% 102%, #343e3d 0 42%, transparent 43%), linear-gradient(135deg, #ead3c4, #a7b9c1); }
	.person.james { background-image: radial-gradient(ellipse at 51% 39%, #d39a77 0 18%, transparent 19%), radial-gradient(ellipse at 50% 29%, #211f21 0 31%, transparent 32%), radial-gradient(ellipse at 50% 102%, #2b5271 0 42%, transparent 43%), linear-gradient(135deg, #ead9c8, #a1b6c3); }
	.person.olivia { background-image: radial-gradient(ellipse at 51% 39%, #e7b598 0 18%, transparent 19%), radial-gradient(ellipse at 50% 29%, #261f1e 0 32%, transparent 33%), radial-gradient(ellipse at 50% 102%, #445c4d 0 42%, transparent 43%), linear-gradient(135deg, #ecd6c8, #afbfbc); }
	.person.bot { background: var(--ui-primary-soft); color: var(--ui-primary); font-size: 26px; }
	.person.bot::before { content: '✦'; }
	.message-copy { display: grid; min-width: 0; flex: 1; gap: 4px; }
	.message-meta { display: flex; align-items: center; gap: 10px; min-width: 0; white-space: nowrap; }
	.message-meta strong { color: var(--ui-text); font-size: 14px; }
	.message-meta > span { overflow: hidden; color: var(--ui-muted); font-size: 12px; text-overflow: ellipsis; }
	.message-meta time { margin-left: auto; color: var(--ui-muted); font-size: 12px; }
	.message-preview { display: -webkit-box; overflow: hidden; color: var(--ui-muted); font-size: 14px; line-height: 1.42; line-clamp: 2; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
	.unread-dot { position: absolute; top: 50%; right: 15px; width: 9px; height: 9px; border-radius: 50%; background: var(--ui-primary); transform: translateY(12px); }

	.thread-panel { display: flex; flex-direction: column; overflow: hidden; }
	.thread-heading { display: flex; align-items: center; gap: 13px; min-height: 80px; padding: 12px 15px; border-bottom: 1px solid var(--ui-border); }
	.thread-heading .person { width: 42px; height: 42px; }
	.thread-heading h2 { margin: 0 0 2px; font-size: 16px; }
	.thread-heading p { margin: 0; color: var(--ui-muted); font-size: 12px; line-height: 1.35; }
	.more-button { margin-left: auto; border: 0; background: transparent; color: var(--ui-text); font-size: 22px; letter-spacing: 1px; cursor: pointer; }
	.conversation { display: grid; align-content: start; gap: 18px; flex: 1; min-height: 0; overflow-y: auto; padding: 17px 14px 14px; }
	.chat-message { display: flex; align-items: flex-start; gap: 12px; }
	.chat-message > .person { width: 42px; height: 42px; }
	.chat-copy { min-width: 0; flex: 1; }
	.chat-meta { display: flex; align-items: center; gap: 8px; min-height: 24px; margin-bottom: 3px; }
	.chat-meta strong { color: var(--ui-text); font-size: 14px; }
	.chat-meta time { color: var(--ui-muted); font-size: 11px; }
	.chat-bubble { padding: 11px 12px; border-radius: var(--ui-radius-sm); background: var(--ui-surface-subtle); color: var(--ui-text); font-size: 14px; line-height: 1.45; white-space: pre-line; }
	.ai-message .chat-bubble { border: 1px solid var(--ui-primary-soft); background: var(--ui-primary-soft); }
	.reply-box { display: grid; margin: 0 14px 14px; padding: 10px 11px 8px; border: 1px solid var(--ui-border); border-radius: var(--ui-radius-sm); background: var(--ui-surface); box-shadow: var(--ui-shadow); }
	.reply-box:focus-within { border-color: var(--ui-primary); box-shadow: 0 0 0 3px var(--ui-primary-soft); }
	.reply-box textarea { width: 100%; min-height: 42px; resize: vertical; border: 0; outline: 0; background: transparent; color: var(--ui-text); font-size: 13px; }
	.reply-box textarea::placeholder { color: var(--ui-muted); }
	.reply-actions { display: flex; align-items: center; gap: 13px; }
	.reply-actions button { display: grid; place-items: center; width: 22px; height: 25px; padding: 0; border: 0; background: transparent; color: var(--ui-muted); font-size: 18px; cursor: pointer; }
	.reply-actions button:hover:not(:disabled), .more-button:hover { background: var(--ui-primary-soft); color: var(--ui-primary); }
	.reply-actions span:last-of-type { flex: 1; }
	.reply-actions span:not(:last-of-type) { color: var(--ui-muted); }
	.reply-actions .send-button { width: 36px; height: 36px; border-radius: var(--ui-radius-sm); background: var(--ui-primary-soft); color: var(--ui-primary); font-size: 19px; }
	.reply-status { padding-top: 5px; color: var(--ui-muted); font-size: 12px; }

	.triage-column { display: grid; grid-template-rows: minmax(0, 1fr) auto; gap: 12px; min-width: 0; }
	.analysis-panel { overflow: hidden; padding: 13px 13px 0; }
	.analysis-heading { display: flex; align-items: center; justify-content: space-between; gap: 8px; min-height: 52px; border-bottom: 1px solid var(--ui-border); }
	.analysis-heading h2 { margin: 0; font-size: 17px; letter-spacing: -.2px; }
	.analysis-heading p { margin: 2px 0 0; color: var(--ui-muted); font-size: 12px; }
	.analysis-row { display: grid; grid-template-columns: 37px minmax(80px, .78fr) minmax(0, 1.3fr); align-items: center; gap: 10px; min-height: 56px; border-bottom: 1px solid var(--ui-border); }
	.analysis-icon { display: grid; width: 36px; height: 36px; flex: none; place-items: center; border-radius: 10px; background: var(--ui-primary-soft); color: var(--ui-primary); font-size: 19px; }
	.analysis-icon.red { background: var(--ui-danger-soft); color: var(--ui-danger); font-size: 22px; }
	.analysis-icon.amber { background: var(--ui-warning-soft); color: var(--ui-warning); font-size: 21px; }
	.analysis-label { color: var(--ui-muted); font-size: 12px; line-height: 1.2; }
	.analysis-value { display: grid; gap: 3px; min-width: 0; }
	.analysis-value strong { overflow-wrap: anywhere; color: var(--ui-text); font-size: 13px; font-weight: 600; }
	.analysis-value small { color: var(--ui-muted); font-size: 11px; line-height: 1.35; }
	.priority-tag { justify-self: start; }
	.urgency-row { min-height: 73px; }
	.assignee-name { display: flex; align-items: center; gap: 7px; }
	.mini { width: 28px; height: 28px; }
	.incidents-row { min-height: 92px; align-items: start; padding: 9px 0; }
	.incidents-row .analysis-icon { margin-top: 1px; }
	.incidents-row .analysis-label { padding-top: 7px; }
	.incidents-row .analysis-value { padding-top: 5px; }
	.incidents-row .analysis-value small { line-height: 1.42; }
	.suggested-response { padding: 9px 0 7px; }
	.response-heading { display: flex; align-items: center; gap: 9px; }
	.response-heading > strong { color: var(--ui-muted); font-size: 12px; }
	.response-heading button { margin-left: auto; padding: 4px 9px; font-size: 11px; }
	.suggested-response p { margin: -1px 0 0 46px; padding: 9px 11px; border-radius: var(--ui-radius-sm); background: var(--ui-surface-subtle); color: var(--ui-text); font-size: 12px; line-height: 1.4; white-space: pre-line; }
	.suggested-response p span { color: var(--ui-muted); }

	.create-panel { align-self: end; padding: 12px 13px 13px; background: var(--ui-surface-subtle); }
	.create-heading { display: flex; align-items: center; gap: 13px; margin-bottom: 9px; }
	.create-icon { display: grid; width: 48px; height: 48px; place-items: center; border-radius: var(--ui-radius); background: var(--ui-primary-soft); color: var(--ui-primary); font-size: 24px; }
	.create-heading h2 { margin: 0 0 2px; color: var(--ui-primary); font-size: 16px; }
	.create-heading p { margin: 0; color: var(--ui-muted); font-size: 12px; }
	.ticket-preview { padding: 9px 11px; border: 1px solid var(--ui-border); border-radius: var(--ui-radius-sm); background: var(--ui-surface); }
	.ticket-preview > strong { display: block; margin-bottom: 8px; overflow-wrap: anywhere; color: var(--ui-text); font-size: 13px; }
	.ticket-preview > div { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
	.ticket-preview .priority-tag { justify-self: auto; }
	.category-tag { background: var(--ui-surface-subtle); color: var(--ui-muted); }
	.assignee-tag { padding-left: 2px; background: transparent; color: var(--ui-text); }
	.assignee-tag .mini { width: 22px; height: 22px; }
	.create-button { width: 100%; margin-top: 8px; }

	@media (max-width: 1350px) {
		.dashboard { padding-right: 16px; padding-left: 16px; }
		.metric-grid { gap: 9px; }
		.metric-card { gap: 10px; padding-right: 10px; padding-left: 10px; }
		.intake-grid { grid-template-columns: minmax(270px, 1fr) minmax(285px, 1fr) minmax(310px, 1.05fr); gap: 9px; }
		.analysis-row { grid-template-columns: 34px minmax(70px, .75fr) minmax(0, 1.25fr); gap: 7px; }
	}
	@media (max-width: 1100px) {
		.metric-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
		.intake-grid { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
		.inbox-panel, .thread-panel { min-height: 760px; }
		.triage-column { grid-column: 1 / -1; grid-template-columns: minmax(0, 1fr) minmax(300px, .75fr); grid-template-rows: auto; align-items: start; }
		.create-panel { align-self: start; }
		.analysis-panel { min-height: 570px; }
	}
	@media (max-width: 700px) {
		.dashboard { padding: 16px 10px 20px; }
		.page-heading { align-items: flex-start; gap: 8px; margin-bottom: 13px; padding: 0 2px; }
		.page-heading p { max-width: 245px; font-size: 12px; }
		.settings-button { padding: 7px; font-size: 12px; }
		.settings-button span { font-size: 15px; }
		.metric-grid { gap: 7px; margin: 0 2px 11px; }
		.metric-card { min-height: 96px; gap: 7px; padding: 9px 7px; }
		.metric-icon { width: 34px; height: 34px; font-size: 21px; }
		.metric-value { gap: 6px; font-size: 21px; }
		.metric-card.success .metric-value { font-size: 17px; }
		.intake-grid { grid-template-columns: 1fr; }
		.inbox-panel { min-height: 550px; }
		.message-list { max-height: 495px; }
		.thread-panel { min-height: 580px; }
		.triage-column { grid-column: auto; grid-template-columns: 1fr; }
		.analysis-panel { min-height: initial; }
		.create-panel { align-self: auto; }
		.inbox-heading { gap: 8px; padding: 0 10px; }
		.channel-select select { max-width: 104px; padding-right: 24px; }
		.message-row { gap: 9px; padding-right: 8px; padding-left: 8px; }
		.person { width: 43px; height: 43px; }
		.message-meta { gap: 5px; }
		.message-row .message-preview { font-size: 12px; }
		.analysis-row { grid-template-columns: 36px minmax(75px, .7fr) minmax(0, 1.3fr); }
	}
</style>
