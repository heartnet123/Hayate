<script lang="ts">
	const metrics = [
		{ change: '↑ +1', icon: '▤', label: 'Drafts', tone: 'blue', value: '2' },
		{ change: '↑ +3', icon: '✓', label: 'Published from Tickets', tone: 'green', value: '8' },
		{ change: '↓ 32%', icon: '◷', label: 'Avg. Time to Publish', tone: 'purple', value: '4h' },
		{ change: '↑ +12%', icon: '▣', label: 'Used in Resolutions', tone: 'blue', value: '92%' }
	];

	const relatedTickets = [
		{ id: '#1018', title: 'Same issue on Dell XPS 13' },
		{ id: '#1007', title: 'Laptop not charging' },
		{ id: '#0985', title: 'Power button not responding' }
	];

	const initialTitle = "How to fix a Dell laptop that won't turn on (Power Reset Procedure)";
	let title = $state(initialTitle);
	let titleDraft = $state(initialTitle);
	let editingTitle = $state(false);
	let editingSection = $state<number | null>(null);
	let sectionDraft = $state('');
	let notice = $state('');
	let sections = $state([
		{
			content: ["This guide explains how to troubleshoot and fix a Dell laptop that won't turn on using a power reset procedure. This issue commonly occurs when the battery enters a deep discharge state."],
			icon: '▤',
			label: 'Overview',
			tone: 'blue',
			type: 'paragraph'
		},
		{
			content: ['Laptop does not turn on', 'No response from power button', 'No LED indicators', 'Device does not charge (initially)'],
			icon: '⚠',
			label: 'Symptoms',
			tone: 'red',
			type: 'list'
		},
		{
			content: ['Battery entered deep discharge state due to long period of inactivity.', 'The embedded controller (EC) needs to be reset to restore normal operation.'],
			icon: 'ϟ',
			label: 'Root Cause',
			tone: 'amber',
			type: 'paragraphs'
		},
		{
			content: ['Disconnect all peripherals (USB devices, external monitors, etc.)', 'Press and hold the power button for 30 seconds', 'Connect the AC adapter and wait for 1 minute', 'Press the power button to turn on the device', 'Verify that the battery is charging and the system boots normally'],
			icon: '☷',
			label: 'Resolution Steps',
			tone: 'green',
			type: 'ordered'
		},
		{
			content: ['Avoid leaving laptops unused for long periods', 'Ensure devices are charged at least once every few weeks', 'Use power management settings (Hibernate instead of full shutdown)'],
			icon: '♢',
			label: 'Prevention',
			tone: 'purple',
			type: 'list'
		}
	]);

	const saveTitle = () => {
		if (titleDraft.trim()) {title = titleDraft.trim();}
		editingTitle = false;
	};

	const startSectionEdit = (index: number) => {
		editingSection = index;
		sectionDraft = sections[index].content.join('\n');
	};

	const saveSection = (index: number) => {
		const content = sectionDraft.split('\n').map((line) => line.trim()).filter(Boolean);
		if (content.length) {sections[index].content = content;}
		editingSection = null;
	};

	const notify = (message: string) => {
		notice = message;
	};
</script>

<svelte:head>
	<title>SOP Drafts | HelpDesk AI</title>
	<meta name="description" content="Turn resolved support tickets into reusable how-to articles." />
</svelte:head>

<main id="main-content" class="sop-page">
	<div class="sop-heading ui-page-heading">
		<div class="heading-copy">
			<h1>SOP Drafts</h1>
			<p class="heading-lead">Turn resolved tickets into reusable how-to articles</p>
			<p>Explore a sample support case. Draft edits remain on this page and are not published.</p>
		</div>
		<section class="metric-grid" aria-label="SOP metrics">
			{#each metrics as metric}
				<article class="metric-card ui-metric-card">
					<span class="metric-icon {metric.tone}" aria-hidden="true">{metric.icon}</span>
					<div class="metric-copy"><strong class="tabular-nums">{metric.value}</strong><span>{metric.label}</span></div>
					<small class="tabular-nums">{metric.change}</small>
				</article>
			{/each}
		</section>
	</div>

	<div class="sop-columns">
		<section class="source-panel ui-panel" aria-labelledby="source-heading">
			<header class="panel-heading">
				<h2 id="source-heading"><span class="heading-icon" aria-hidden="true">▣</span>Source Ticket</h2>
			</header>
			<div class="ticket-summary">
				<div class="ticket-meta"><span class="ticket-number"><i aria-hidden="true">▣</i> #1023</span><span class="resolved-badge ui-badge">Resolved</span><time class="tabular-nums">Resolved 15m ago</time></div>
				<h3>Laptop won't turn on</h3>
				<dl class="ticket-facts">
					<div class="fact-item">
						<dt><span class="fact-icon" aria-hidden="true">♙</span>User</dt>
						<dd><strong>Pimchan R.</strong></dd>
					</div>
					<div class="fact-item">
						<dt><span class="fact-icon" aria-hidden="true">♧</span>Department</dt>
						<dd><strong>Hardware</strong></dd>
					</div>
					<div class="fact-item">
						<dt><span class="fact-icon" aria-hidden="true">▱</span>Device</dt>
						<dd><strong>Dell Latitude 7420</strong></dd>
					</div>
					<div class="fact-item">
						<dt><span class="fact-icon" aria-hidden="true">▧</span>Created</dt>
						<dd><strong class="tabular-nums">Apr 24, 2024, 10:14 AM</strong></dd>
					</div>
					<div class="fact-item">
						<dt><span class="fact-icon" aria-hidden="true">♙</span>Resolved by</dt>
						<dd><strong>Wiat P.</strong></dd>
					</div>
				</dl>
			</div>
			<div class="ticket-details">
				<section class="detail-block"><h3><span aria-hidden="true">◷</span>Description</h3><p>User reported that the laptop suddenly won't turn on. Power button shows no response. Tried different charger, still no power.</p></section>
				<section class="detail-block"><h3><span aria-hidden="true">⌕</span>Root Cause (from ticket)</h3><p>Battery entered deep discharge state due to long period of inactivity. Required power reset procedure.</p></section>
				<section class="detail-block resolution-source"><h3><span aria-hidden="true">✓</span>Resolution (from ticket)</h3><ol><li>Disconnect all peripherals</li><li>Press and hold power button for 30 seconds</li><li>Connect AC adapter and wait 1 minute</li><li>Power on the device</li><li>Verify battery is charging</li></ol></section>
			</div>
			<div class="source-tags"><h3><span aria-hidden="true">◆</span>Tags</h3><span class="tag blue-tag">Laptop</span><span class="tag red-tag">Power</span><span class="tag green-tag">Hardware</span><span class="tag blue-tag">Dell</span></div>
			<section class="related-list" aria-labelledby="related-heading">
				<header><h3 id="related-heading"><span aria-hidden="true">♧</span>Related Tickets</h3></header>
				{#each relatedTickets as ticket}
					<div class="related-row"><strong>{ticket.id}</strong><span>{ticket.title}</span><small>Resolved</small></div>
				{/each}
			</section>
		</section>

		<section class="draft-panel ui-panel" aria-labelledby="draft-heading">
			<header class="draft-header">
				<div class="draft-title"><span class="spark" aria-hidden="true">✦</span><h2 id="draft-heading">AI-generated SOP Draft</h2><span class="draft-badge ui-badge">Draft</span></div>
				<div class="confidence"><span>AI Confidence <button type="button" class="tooltip-trigger" title="Confidence based on source ticket and similar cases" aria-label="Confidence based on source ticket and similar cases">ⓘ</button></span><strong class="tabular-nums">92%</strong><div role="progressbar" aria-valuenow="92" aria-valuemin="0" aria-valuemax="100" aria-label="AI Confidence 92%"><i style="width: 92%"></i></div></div>
				<p class="similar-count">Generated from 1 ticket<br />and 4 similar cases</p>
			</header>

			<div class="title-field">
				{#if editingTitle}
					<input aria-label="SOP title" bind:value={titleDraft} onkeydown={(event) => event.key === 'Enter' && saveTitle()} />
					<button type="button" onclick={saveTitle}>Save</button>
				{:else}
					<h3>{title}</h3>
					<button type="button" onclick={() => { titleDraft = title; editingTitle = true; }}><span aria-hidden="true">⌁</span> Edit title</button>
				{/if}
			</div>

			<div class="draft-sections">
				{#each sections as section, index}
					<article class="draft-section">
						<div class="section-label"><span class="section-icon {section.tone}" aria-hidden="true">{section.icon}</span><h3>{section.label}</h3></div>
						<div class="section-content" class:is-editing={editingSection === index}>
							<div class="section-body">
								{#if editingSection === index}
									<textarea aria-label="Edit {section.label}" bind:value={sectionDraft} rows={Math.max(3, section.content.length)}></textarea>
								{:else if section.type === 'paragraph'}
									<p>{section.content.join(' ')}</p>
								{:else if section.type === 'paragraphs'}
									{#each section.content as paragraph}<p>{paragraph}</p>{/each}
								{:else if section.type === 'ordered'}
									<ol>{#each section.content as item}<li>{item}</li>{/each}</ol>
								{:else}
									<ul>{#each section.content as item}<li>{item}</li>{/each}</ul>
								{/if}
							</div>
							<div class="section-actions">
								{#if editingSection === index}
									<button type="button" class="save-button" onclick={() => saveSection(index)}>Save</button>
									<button type="button" onclick={() => (editingSection = null)}>Cancel</button>
								{:else}
									<button type="button" onclick={() => startSectionEdit(index)}><span aria-hidden="true">⌁</span> Edit</button>
								{/if}
							</div>
						</div>
					</article>
				{/each}
				<article class="review-row"><span class="section-icon slate" aria-hidden="true">▤</span><h3>Review Status</h3><div class="review-copy"><span class="review-badge">◈&nbsp; Pending Review</span><p>Created today at 6:14 PM by AI. Ready for technical review.</p></div></article>
			</div>

			<footer class="draft-actions">
				<label>Assign Reviewer <span class="select-wrap"><span class="reviewer-avatar" aria-hidden="true">W</span><select value="Wiat P." aria-label="Assign reviewer"><option>Wiat P.</option><option>Alex Rivera</option><option>Sarah Chen</option></select></span></label>
				<label>Publish Target <span class="select-wrap"><span aria-hidden="true">▣</span><select value="Knowledge Base" aria-label="Publish target"><option>Knowledge Base</option><option>Internal Wiki</option></select></span></label>
				<span class="action-spacer"></span>
				<button type="button" class="secondary-action ui-button ui-button-quiet" onclick={() => notify('Preview only. Draft was not saved.')}><span aria-hidden="true">⌁</span> <span>Save Draft</span></button>
				<button type="button" class="secondary-action ui-button ui-button-quiet" onclick={() => notify('Preview only. Review request was not sent.')}>Request Review</button>
				<button type="button" class="primary-action ui-button ui-button-primary" onclick={() => notify('Preview only. SOP was not published.')}><span aria-hidden="true">✓</span> <span>Approve &amp; Publish</span></button>
			</footer>
		</section>
	</div>
	<footer class="help-note"><span class="note-spark" aria-hidden="true">✦</span><span>Turning support tickets into documentation helps your team resolve issues faster, reduces repetitive requests, and builds a smarter internal knowledge base.</span><button type="button" onclick={() => notify('Preview only. Draft actions do not save or publish.')}>Learn more about SOP drafts <span aria-hidden="true">↗</span></button></footer>
	{#if notice}<div class="notice" role="alert">{notice}</div>{/if}
</main>

<style>
	.sop-page { display: flex; min-width: 0; min-height: 0; flex-direction: column; gap: 16px; overflow: auto; padding: 18px 21px 10px; color: var(--ui-text); }
	.sop-heading { display: grid; grid-template-columns: minmax(280px, 1fr) minmax(600px, 1.5fr); align-items: center; gap: 20px; }
	.heading-copy p { margin: 2px 0 0; color: var(--ui-muted); font-size: 14px; }
	.heading-copy .heading-lead { margin-top: 4px; color: var(--ui-text); font-size: 17px; }
	.metric-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 13px; }
	.metric-card { display: grid; grid-template-columns: 40px minmax(0, 1fr) auto; align-items: center; gap: 12px; min-height: 74px; padding: 10px; }
	.metric-icon { display: grid; width: 39px; height: 39px; place-items: center; border-radius: 9px; background: var(--ui-primary-soft); font-size: 21px; }
	.metric-icon.blue { color: var(--ui-primary); }
	.metric-icon.green { background: var(--ui-success-soft); color: var(--ui-success); }
	.metric-icon.purple { background: var(--ui-primary-soft); color: var(--ui-primary); }
	.metric-copy { display: grid; min-width: 0; gap: 4px; }
	.metric-copy strong { color: var(--ui-text); font-size: 22px; font-weight: 500; line-height: 1; }
	.metric-copy span { overflow: hidden; color: var(--ui-muted); font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
	.metric-card small { align-self: start; color: var(--ui-success); font-size: 11px; white-space: nowrap; }
	.sop-columns { display: grid; grid-template-columns: minmax(390px, .9fr) minmax(0, 1.65fr); flex: 1; gap: 20px; min-height: 0; }
	.source-panel, .draft-panel { min-width: 0; overflow: hidden; }
	.source-panel { display: flex; flex-direction: column; padding: 0 15px; }
	.panel-heading, .draft-header { display: flex; align-items: center; border-bottom: 1px solid var(--ui-border); }
	.panel-heading { justify-content: space-between; min-height: 50px; }
	.panel-heading h2, .draft-title { display: flex; align-items: center; gap: 12px; margin: 0; color: var(--ui-text); font-size: 16px; font-weight: 550; }
	.heading-icon { display: grid; width: 23px; height: 23px; place-items: center; border-radius: 5px; background: var(--ui-primary-soft); color: var(--ui-primary); font-size: 14px; }
	.panel-heading>a { color: var(--ui-primary); font-size: 12px; }
	.panel-heading>a span { margin-left: 5px; font-size: 15px; }
	.ticket-summary { padding: 12px 0 9px; border-bottom: 1px solid var(--ui-border); }
	.ticket-meta { display: flex; align-items: center; gap: 17px; }
	.ticket-number { display: flex; align-items: center; gap: 10px; color: var(--ui-text); font-size: 14px; font-weight: 600; }
	.ticket-number i { display: grid; width: 22px; height: 22px; place-items: center; border-radius: 6px; background: var(--ui-danger-soft); color: var(--ui-danger); font-size: 12px; font-style: normal; }
	.resolved-badge { padding: 5px 11px; border-radius: 999px; background: var(--ui-success-soft); color: var(--ui-success); font-size: 11px; }
	.ticket-meta time { margin-left: auto; color: var(--ui-muted); font-size: 11px; }
	.ticket-summary h3 { margin: 9px 0 10px; color: var(--ui-text); font-size: 15px; font-weight: 550; }
	.ticket-facts { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px 10px; margin: 0; }
	.ticket-facts .fact-item { display: flex; align-items: center; gap: 10px; min-width: 0; }
	.ticket-facts dt { display: flex; align-items: center; gap: 6px; color: var(--ui-muted); font-size: 11px; }
	.fact-icon { display: grid; width: 18px; flex: none; place-items: center; color: var(--ui-muted); font-size: 15px; text-align: center; }
	.ticket-facts dd { margin: 0; min-width: 0; }
	.ticket-facts strong { overflow: hidden; color: var(--ui-text); font-size: 11px; font-weight: 500; text-overflow: ellipsis; white-space: nowrap; }
	.ticket-details { display: grid; gap: 11px; padding: 11px 0; }
	.detail-block h3, .source-tags h3, .related-list h3 { display: flex; align-items: center; gap: 11px; margin: 0 0 6px; color: var(--ui-muted); font-size: 12px; font-weight: 500; }
	.detail-block h3 span, .source-tags h3 span, .related-list h3 span { width: 19px; color: var(--ui-muted); font-size: 15px; text-align: center; }
	.detail-block p, .detail-block ol { margin: 0 0 0 30px; padding: 8px 10px; border: 1px solid var(--ui-border); border-radius: 8px; background: var(--ui-surface-subtle); color: var(--ui-text); font-size: 12px; line-height: 1.45; }
	.detail-block ol { padding-left: 29px; }
	.detail-block li { padding-left: 2px; }
	.resolution-source h3 span { display: grid; width: 16px; height: 16px; place-items: center; margin-left: 2px; border-radius: 50%; background: var(--ui-success-soft); color: var(--ui-success); font-size: 11px; }
	.source-tags { display: flex; align-items: center; gap: 7px; padding: 3px 0 9px; }
	.source-tags h3 { margin: 0 9px 0 0; }
	.tag { padding: 5px 11px; border-radius: 7px; font-size: 11px; }
	.blue-tag { background: var(--ui-primary-soft); color: var(--ui-primary); }
	.red-tag { background: var(--ui-danger-soft); color: var(--ui-danger); }
	.green-tag { background: var(--ui-success-soft); color: var(--ui-success); }
	.source-tags>button { width: 28px; height: 25px; border: 1px solid var(--ui-border); border-radius: 6px; background: transparent; color: var(--ui-text); cursor: pointer; }
	.related-list { padding: 8px 0 4px; border-top: 1px solid var(--ui-border); }
	.related-list header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 3px; }
	.related-list h3 { margin: 0; }
	.related-list header button { border: 0; background: transparent; color: var(--ui-primary); font-size: 11px; cursor: pointer; }
	.related-row { display: grid; grid-template-columns: 62px minmax(0, 1fr) auto; align-items: center; gap: 8px; min-height: 28px; padding-left: 30px; border-bottom: 1px solid var(--ui-border); color: var(--ui-muted); font-size: 11px; }
	.related-row strong { font-weight: 450; }
	.related-row small { padding: 4px 10px; border-radius: 20px; background: var(--ui-success-soft); color: var(--ui-success); font-size: 11px; }
	.draft-panel { display: flex; flex-direction: column; padding: 0 15px 11px; }
	.draft-header { min-height: 68px; gap: 18px; }
	.draft-title { flex: 1; gap: 12px; white-space: nowrap; }
	.draft-title h2 { margin: 0; font-size: 17px; font-weight: 550; }
	.spark { color: var(--ui-primary); font-size: 23px; }
	.draft-badge { padding: 5px 12px; border-radius: 999px; background: var(--ui-warning-soft); color: var(--ui-warning); font-size: 11px; }
	.confidence { display: grid; grid-template-columns: auto 122px; align-items: center; gap: 3px 10px; color: var(--ui-muted); font-size: 11px; }
	.confidence>span { white-space: nowrap; }
	.tooltip-trigger { display: inline; padding: 0; margin-left: 4px; border: 0; background: transparent; color: var(--ui-muted); font-size: 12px; cursor: help; }
	.tooltip-trigger:hover, .tooltip-trigger:focus-visible { color: var(--ui-primary); }
	.confidence strong { color: var(--ui-text); font-size: 15px; font-weight: 500; }
	.confidence>div { grid-column: 2; height: 8px; overflow: hidden; border-radius: 9px; background: var(--ui-primary-soft); }
	.confidence>div i { display: block; height: 100%; border-radius: inherit; background: var(--ui-success); }
	.similar-count { margin: 0 0 0 auto; padding-left: 14px; border-left: 1px solid var(--ui-border); color: var(--ui-muted); font-size: 11px; line-height: 1.5; }
	.title-field { display: flex; align-items: center; gap: 10px; min-height: 47px; margin: 10px 0 11px; padding: 0 11px; border: 1px solid var(--ui-border); border-radius: 8px; background: var(--ui-surface); }
	.title-field h3 { overflow: hidden; flex: 1; margin: 0; color: var(--ui-text); font-size: 17px; font-weight: 500; text-overflow: ellipsis; white-space: nowrap; }
	.title-field input { min-width: 0; flex: 1; padding: 7px; border: 1px solid var(--ui-border); border-radius: 5px; background: var(--ui-surface); color: var(--ui-text); }
	.title-field button { display: flex; align-items: center; gap: 6px; flex: none; padding: 7px 9px; border: 0; border-radius: 6px; background: transparent; color: var(--ui-primary); font-size: 11px; cursor: pointer; }
	.draft-sections { display: grid; gap: 6px; }
	.draft-section { display: grid; grid-template-columns: 175px minmax(0, 1fr); align-items: stretch; gap: 12px; }
	.section-label { display: flex; align-items: center; gap: 14px; min-width: 0; }
	.section-label h3, .review-row h3 { margin: 0; color: var(--ui-text); font-size: 13px; font-weight: 500; }
	.section-icon { display: grid; width: 40px; height: 40px; flex: none; place-items: center; border-radius: 9px; font-size: 21px; }
	.section-icon.blue { background: var(--ui-primary-soft); color: var(--ui-primary); }
	.section-icon.red { background: var(--ui-danger-soft); color: var(--ui-danger); }
	.section-icon.amber { background: var(--ui-warning-soft); color: var(--ui-warning); font-size: 24px; }
	.section-icon.green { background: var(--ui-success-soft); color: var(--ui-success); }
	.section-icon.purple { background: var(--ui-primary-soft); color: var(--ui-primary); }
	.section-icon.slate { background: var(--ui-primary-soft); color: var(--ui-muted); }
	.section-content { position: relative; display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; min-width: 0; min-height: 56px; padding: 10px 14px; border: 1px solid var(--ui-border); border-radius: 8px; background: var(--ui-surface-subtle); color: var(--ui-text); font-size: 12px; line-height: 1.4; }
	.section-body { flex: 1; min-width: 0; }
	.section-content p, .section-content ul, .section-content ol { margin: 0; padding: 0; }
	.section-content ul, .section-content ol { padding-left: 18px; }
	.section-content li { padding-left: 2px; }
	.section-content textarea { width: 100%; min-height: 56px; resize: vertical; border: 0; outline: 0; background: transparent; color: var(--ui-text); font: inherit; }
	.section-actions { display: flex; gap: 5px; flex: none; }
	.section-actions button, .review-row>button { padding: 8px 10px; border: 1px solid var(--ui-border); border-radius: 6px; background: var(--ui-surface); color: var(--ui-text); font-size: 11px; white-space: nowrap; cursor: pointer; }
	.section-actions button span { margin-right: 4px; color: var(--ui-text); }
	.section-actions .save-button { border-color: var(--ui-success); background: var(--ui-success-soft); color: var(--ui-success); }
	.review-row { display: grid; grid-template-columns: 40px 120px minmax(0, 1fr) auto; align-items: center; gap: 14px; min-height: 48px; padding-top: 5px; border-top: 1px solid var(--ui-border); }
	.review-copy { display: flex; align-items: center; gap: 13px; min-width: 0; }
	.review-badge { padding: 5px 9px; border: 1px solid var(--ui-warning); border-radius: 999px; background: var(--ui-warning-soft); color: var(--ui-warning); font-size: 11px; white-space: nowrap; }
	.section-content:focus-within, .title-field:focus-within, .select-wrap:focus-within { outline: 2px solid var(--ui-primary); outline-offset: 2px; }
	.review-copy p { overflow: hidden; margin: 0; color: var(--ui-muted); font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }
	.draft-actions { display: flex; align-items: center; gap: 8px; min-height: 57px; margin-top: auto; border-top: 1px solid var(--ui-border); }
	.draft-actions label { display: flex; align-items: center; gap: 8px; color: var(--ui-muted); font-size: 11px; white-space: nowrap; }
	.select-wrap { display: flex; align-items: center; gap: 6px; padding: 6px 8px; border: 1px solid var(--ui-border); border-radius: 7px; background: var(--ui-surface); color: var(--ui-muted); }
	.select-wrap select { max-width: 100px; border: 0; outline: 0; background: transparent; color: var(--ui-muted); font-size: 11px; }
	.select-wrap option { background: var(--ui-surface); }
	.reviewer-avatar { display: grid; width: 21px; height: 21px; place-items: center; border-radius: 50%; background: var(--ui-primary-soft); color: var(--ui-primary); font-size: 11px; }
	.action-spacer { flex: 1; }
	.secondary-action, .primary-action { display: inline-flex; align-items: center; justify-content: center; gap: 7px; min-height: 39px; padding: 0 11px; border: 1px solid var(--ui-border); border-radius: 7px; background: var(--ui-surface); color: var(--ui-muted); font-size: 11px; white-space: nowrap; cursor: pointer; }
	.primary-action { border-color: var(--ui-primary); background: var(--ui-primary); color: white; }
	.help-note { display: flex; align-items: center; gap: 10px; min-height: 34px; padding: 0 12px; border: 1px solid var(--ui-border); border-radius: 7px; background: var(--ui-surface); color: var(--ui-muted); font-size: 11px; }
	.note-spark { color: var(--ui-primary); font-size: 17px; }
	.help-note>span:nth-child(2) { flex: 1; }
	.help-note button { display: flex; align-items: center; gap: 7px; border: 0; background: transparent; color: var(--ui-primary); font-size: 11px; white-space: nowrap; cursor: pointer; }
	.notice { position: fixed; right: 24px; bottom: 22px; z-index: 5; padding: 11px 16px; border: 1px solid var(--ui-danger); border-radius: var(--ui-radius-sm); background: var(--ui-danger-soft); color: var(--ui-danger); font-size: 13px; box-shadow: var(--ui-shadow); }

	@media (max-width: 1350px) {
		.sop-page { padding-right: 15px; padding-left: 15px; }
		.sop-heading { grid-template-columns: minmax(240px, .75fr) minmax(520px, 1.5fr); gap: 12px; }
		.metric-grid { gap: 8px; }
		.metric-card { grid-template-columns: 34px minmax(0, 1fr); gap: 8px; padding: 8px; }
		.metric-icon { width: 34px; height: 34px; font-size: 18px; }
		.metric-card small { display: none; }
		.sop-columns { grid-template-columns: minmax(350px, .85fr) minmax(0, 1.5fr); gap: 12px; }
		.draft-section { grid-template-columns: 145px minmax(0, 1fr); gap: 8px; }
		.section-label { gap: 9px; }
		.section-icon { width: 35px; height: 35px; }
		.draft-actions { gap: 5px; }
		.draft-actions label { gap: 4px; font-size: 11px; }
		.select-wrap { padding: 5px; }
		.secondary-action, .primary-action { padding: 0 8px; font-size: 11px; }
	}
	@media (max-width: 1100px) {
		.sop-page { overflow: visible; }
		.sop-heading { grid-template-columns: 1fr; }
		.metric-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
		.metric-card { grid-template-columns: 35px minmax(0, 1fr) auto; }
		.metric-card small { display: block; }
		.sop-columns { grid-template-columns: minmax(300px, .85fr) minmax(0, 1.5fr); }
	}
	@media (max-width: 850px) {
		.sop-columns { grid-template-columns: 1fr; }
		.source-panel { min-height: 0; }
		.draft-panel { min-height: 650px; }
		.draft-actions { flex-wrap: wrap; padding: 8px 0; }
		.action-spacer { display: none; }
	}
	@media (max-width: 700px) {
		.sop-page { gap: 12px; padding: 14px 10px; }
		.heading-copy h1 { font-size: 24px; }
		.heading-copy .heading-lead { font-size: 14px; }
		.heading-copy p { font-size: 12px; }
		.metric-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 7px; }
		.metric-card { min-height: 62px; grid-template-columns: 31px minmax(0, 1fr) auto; gap: 6px; padding: 7px; }
		.metric-icon { width: 30px; height: 30px; font-size: 16px; }
		.metric-copy strong { font-size: 17px; }
		.metric-copy span { font-size: 11px; }
		.metric-card small { font-size: 11px; }
		.source-panel { padding: 0 11px; }
		.draft-panel { min-height: 0; padding: 0 10px 10px; }
		.draft-header { flex-wrap: wrap; gap: 8px; padding: 10px 0; }
		.draft-title { gap: 6px; }
		.draft-title h2 { font-size: 14px; }
		.draft-badge { padding: 4px 7px; font-size: 11px; }
		.confidence { grid-template-columns: auto 65px; gap: 4px; font-size: 11px; }
		.confidence>span { font-size: 11px; }
		.similar-count { display: none; }
		.title-field h3 { font-size: 14px; }
		.draft-section { grid-template-columns: 1fr; gap: 5px; }
		.section-label { gap: 8px; }
		.section-icon { width: 29px; height: 29px; font-size: 17px; }
		.section-label h3, .review-row h3 { font-size: 12px; }
		.section-content { min-height: 48px; padding: 8px 10px; font-size: 12px; }
		.section-actions button { padding: 6px; font-size: 11px; }
		.review-row { grid-template-columns: 29px minmax(80px, auto) minmax(0, 1fr); gap: 7px; }
		.review-row .section-icon { width: 29px; height: 29px; }
		.review-row>button { grid-column: 3; justify-self: end; padding: 5px 7px; }
		.review-copy { grid-column: 2 / -1; flex-wrap: wrap; gap: 6px; }
		.review-copy p { font-size: 11px; }
		.draft-actions label { width: 100%; justify-content: space-between; }
		.select-wrap { min-width: 145px; justify-content: flex-end; }
		.select-wrap select { flex: 1; max-width: none; }
		.secondary-action, .primary-action { flex: 1; min-height: 36px; font-size: 11px; }
		.help-note { align-items: flex-start; padding: 8px; font-size: 11px; line-height: 1.4; }
		.help-note button { font-size: 11px; }
	}
</style>
