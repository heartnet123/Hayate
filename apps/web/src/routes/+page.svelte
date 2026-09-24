<script lang="ts">
	const metrics = [
		{ change: '↓ 18%', icon: '▱', label: 'Open Tickets', tone: 'blue', value: '48' },
		{ change: '↓ 12%', icon: '◷', label: 'In Progress', tone: 'amber', value: '32' },
		{ change: '↑ 28%', icon: '✓', label: 'Resolved', tone: 'green', value: '214' },
		{ change: '↑ 0.3', icon: '♡', label: 'CSAT', suffix: '/ 5', tone: 'pink', value: '4.6' }
	];

	const tickets = [
		{ assignee: 'Alex Rivera', category: 'Technical Issue', color: '#d88967', id: '#327', initials: 'AR', priority: 'High', status: 'Open', title: 'Cannot access production environment' },
		{ assignee: 'Priya Desai', category: 'Billing', color: '#c58a5e', id: '#326', initials: 'PD', priority: 'Medium', status: 'In Progress', title: 'Billing invoice not received' },
		{ assignee: 'Daniel Kim', category: 'Account & Access', color: '#6695bf', id: '#325', initials: 'DK', priority: 'Low', status: 'Waiting on User', title: 'Request for additional user seats' },
		{ assignee: 'Sarah Chen', category: 'Technical Issue', color: '#bd7865', id: '#324', initials: 'SC', priority: 'High', status: 'In Progress', title: 'Error message when exporting reports' },
		{ assignee: 'Marcus Lee', category: 'How-to / Guidance', color: '#416e65', id: '#323', initials: 'ML', priority: 'Low', status: 'Resolved', title: 'How to set up Slack notifications?' }
	];

	const categories = [
		{ color: '#3c82f6', label: 'Technical Issue', value: '28%' },
		{ color: '#7957e8', label: 'Account & Access', value: '22%' },
		{ color: '#e75b8c', label: 'Billing', value: '15%' },
		{ color: '#f5ac27', label: 'Feature Request', value: '12%' },
		{ color: '#43b184', label: 'How-to / Guidance', value: '10%' },
		{ color: '#b8c5d9', label: 'Other', value: '13%' }
	];
</script>

<svelte:head>
	<title>Dashboard | HelpDesk AI</title>
	<meta name="description" content="HelpDesk AI support operations dashboard." />
</svelte:head>

<main id="main-content" class="dashboard">
	<div class="page-heading ui-page-heading"><div><h1>Dashboard</h1><p>Sample support data for exploring HelpDesk AI. Metrics are not live.</p></div><span class="date-button ui-badge"><span aria-hidden="true">▣</span> Sample period: April 2024</span></div>

	<section class="metric-grid" aria-label="Support metrics">
		{#each metrics as metric}
			<article class="metric-card ui-metric-card {metric.tone}"><div class="metric-icon ui-metric-icon" aria-hidden="true">{metric.icon}</div><div class="metric-content"><p>{metric.label}</p><div class="metric-value tabular-nums">{metric.value}{#if metric.suffix}<small>{metric.suffix}</small>{/if}</div><span class="metric-change tabular-nums">{metric.change}</span><small class="metric-caption">vs. previous 30 days</small></div></article>
		{/each}
	</section>

	<div class="analytics-grid">
		<section class="panel ui-panel trend-panel"><div class="panel-heading"><div><h2>Ticket Status Trend</h2><p>Tickets created and resolved over time</p></div><div class="legend"><span><i class="blue-dot" aria-hidden="true"></i>Open</span><span><i class="amber-dot" aria-hidden="true"></i>In Progress</span><span><i class="green-dot" aria-hidden="true"></i>Resolved</span></div></div>
			<div class="chart-wrap"><div class="y-labels tabular-nums"><span>200</span><span>150</span><span>100</span><span>50</span><span>0</span></div><div class="chart-area"><div class="grid-lines" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div><svg viewBox="0 0 720 180" preserveAspectRatio="none" role="img" aria-label="Ticket volume trend over the last 30 days"><defs><linearGradient id="greenFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#10a878" stop-opacity=".19"/><stop offset="1" stop-color="#10a878" stop-opacity="0"/></linearGradient></defs><polygon points="0,180 0,132 72,114 144,120 216,107 288,105 360,93 432,69 504,61 576,55 648,50 720,29 720,180" fill="url(#greenFill)"/><polyline points="0,132 72,114 144,120 216,107 288,105 360,93 432,69 504,61 576,55 648,50 720,29" fill="none" stroke="#13a575" stroke-width="2.5" vector-effect="non-scaling-stroke"/><polyline points="0,148 72,130 144,139 216,131 288,124 360,111 432,96 504,87 576,94 648,105 720,102" fill="none" stroke="#397ff0" stroke-width="2.5" vector-effect="non-scaling-stroke"/><polyline points="0,162 72,159 144,163 216,167 288,161 360,155 432,139 504,134 576,127 648,129 720,141" fill="none" stroke="#f5a623" stroke-width="2.5" vector-effect="non-scaling-stroke"/></svg><div class="x-labels"><span>Apr 1</span><span>Apr 5</span><span>Apr 9</span><span>Apr 13</span><span>Apr 17</span><span>Apr 21</span><span>Apr 25</span><span>Apr 30</span></div></div></div>
		</section>

		<section class="panel ui-panel category-panel"><div class="panel-heading"><h2>Tickets by Category</h2></div><div class="category-content"><div class="donut" role="img" aria-label="Tickets by category: 298 total tickets"><div><strong class="tabular-nums">298</strong><span>Tickets</span></div></div><ul class="category-legend">{#each categories as category}<li><i style="--category-color: {category.color}" aria-hidden="true"></i><span>{category.label}</span><strong class="tabular-nums">{category.value}</strong></li>{/each}</ul></div></section>
	</div>

	<div class="summary-grid">
		<section class="panel ui-panel csat-panel"><div class="panel-heading"><h2>CSAT Survey Summary</h2></div><div class="csat-content"><div class="csat-score"><strong class="tabular-nums">4.6 <small>/ 5</small></strong><div class="stars" aria-label="4.6 out of 5 stars">★★★★★</div><p>Based on 142 responses</p></div><div class="rating-bars">{#each [{ label: '5 stars', value: 68, color: 'green' }, { label: '4 stars', value: 22, color: 'blue' }, { label: '3 stars', value: 7, color: 'amber' }, { label: '2 stars', value: 2, color: 'orange' }, { label: '1 star', value: 1, color: 'red' }] as rating}<div class="rating-row"><span>{rating.label}</span><div class="rating-track" role="progressbar" aria-valuenow={rating.value} aria-valuemin="0" aria-valuemax="100" aria-label="{rating.label}: {rating.value}%"><i class={rating.color} style="width: {rating.value}%"></i></div><strong class="tabular-nums">{rating.value}%</strong></div>{/each}</div></div></section>
		<section class="panel ui-panel insights-panel"><div class="panel-heading"><h2><span aria-hidden="true">✦</span> AI Insights</h2></div><div class="insight-list"><article><i class="danger" aria-hidden="true">⚠</i><div><small>Top recurring issue</small><strong>SSO login failures</strong><p>42 tickets in the last 30 days (↑ 28%)</p></div></article><article><i class="info" aria-hidden="true">▤</i><div><small>Suggested KB article</small><strong>How to fix SSO login issues</strong><p>Could resolve ~62% of similar tickets</p></div></article><article><i class="success" aria-hidden="true">ϟ</i><div><small>Automation saved time</small><strong>~ 36 hours</strong><p>Auto-triage and AI replies this month</p></div></article></div></section>
	</div>

	<section class="panel ui-panel recent-panel"><div class="panel-heading"><h2>Recent Tickets</h2></div><div class="table-scroll"><table><thead><tr><th scope="col">ID</th><th scope="col">Title</th><th scope="col">Priority</th><th scope="col">Category</th><th scope="col">Assignee</th><th scope="col">Status</th></tr></thead><tbody>{#each tickets as ticket}<tr><th scope="row" class="ticket-id-cell tabular-nums">{ticket.id}</th><td class="ticket-title">{ticket.title}</td><td><span class="priority ui-badge {ticket.priority.toLowerCase()}">{ticket.priority}</span></td><td>{ticket.category}</td><td><span class="assignee"><i style="--avatar-color:{ticket.color}" aria-hidden="true">{ticket.initials}</i>{ticket.assignee}</span></td><td><span class="status ui-badge {ticket.status.toLowerCase().replaceAll(' ', '-')}">{ticket.status}</span></td></tr>{/each}</tbody></table></div></section>
</main>

<style>
	.dashboard { min-width: 0; overflow: auto; padding: 14px 26px 22px; }
	.page-heading { margin-bottom: 19px; }
	.date-button { padding: 8px 12px; }
	.metric-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 13px; margin-bottom: 16px; }
	.metric-card { min-height: 116px; }
	.metric-card.blue { --icon-bg: var(--ui-primary-soft); --icon-color: var(--ui-primary); }
	.metric-card.amber { --icon-bg: var(--ui-warning-soft); --icon-color: var(--ui-warning); }
	.metric-card.green { --icon-bg: var(--ui-success-soft); --icon-color: var(--ui-success); }
	.metric-card.pink { --icon-bg: #fff0f6; --icon-color: #b83466; }
	.metric-icon { background: var(--icon-bg); color: var(--icon-color); }
	.metric-content { min-width: 0; padding-top: 2px; }
	.metric-content p { margin: 0 0 3px; font-size: 13px; }
	.metric-value { font-size: 27px; line-height: 1.15; font-weight: 700; letter-spacing: -.5px; }
	.metric-value small { color: #75829b; font-size: 15px; font-weight: 600; }
	.metric-change { display: inline-block; margin-top: 4px; color: #099766; font-size: 13px; font-weight: 600; }
	.metric-caption { display: block; color: #7a879f; font-size: 11px; }
	.analytics-grid, .summary-grid { display: grid; grid-template-columns: minmax(0, 1.55fr) minmax(360px, 1fr); gap: 14px; margin-bottom: 15px; }
	.panel { min-width: 0; }
	.trend-panel, .category-panel { min-height: 252px; padding: 14px 18px; }
	.panel-heading { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
	.panel-heading h2 { margin: 0; font-size: 16px; letter-spacing: -.2px; text-wrap: balance; }
	.panel-heading p { margin: 2px 0 0; color: var(--ui-muted); font-size: 13px; text-wrap: pretty; }
	.legend { display: flex; gap: 17px; color: var(--ui-muted); font-size: 12px; }
	.legend span { display: flex; align-items: center; gap: 6px; white-space: nowrap; }
	.legend i { width: 8px; height: 8px; border-radius: 50%; }
	.blue-dot { background: #4383f3; }
	.amber-dot { background: #f5b330; }
	.green-dot { background: #1ca577; }
	.chart-wrap { display: grid; grid-template-columns: 29px minmax(0, 1fr); height: 172px; margin-top: 15px; }
	.y-labels { display: flex; flex-direction: column; justify-content: space-between; padding: 0 4px 22px 0; color: var(--ui-muted); font-size: 11px; }
	.chart-area { position: relative; min-width: 0; margin-bottom: 22px; border-bottom: 1px solid #dfe5ef; border-left: 1px solid #dfe5ef; }
	.grid-lines { position: absolute; inset: 0; display: flex; flex-direction: column; justify-content: space-between; }
	.grid-lines i { border-top: 1px solid #edf1f6; }
	.chart-area svg { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
	.x-labels { position: absolute; right: 0; bottom: -24px; left: 0; display: flex; justify-content: space-between; color: var(--ui-muted); font-size: 11px; }
	.x-labels span { white-space: nowrap; }
	.category-content { display: flex; align-items: center; justify-content: space-between; gap: 20px; min-height: 190px; padding: 7px 0 0 10px; }
	.donut { position: relative; display: grid; place-items: center; width: 154px; height: 154px; flex: none; border-radius: 50%; background: conic-gradient(#3c82f6 0 27.3%, #fff 27.3% 27.9%, #7957e8 27.9% 49.4%, #fff 49.4% 50%, #e75b8c 50% 64.5%, #fff 64.5% 65.1%, #f5ac27 65.1% 76.7%, #fff 76.7% 77.3%, #43b184 77.3% 87%, #fff 87% 87.6%, #b8c5d9 87.6% 100%); }
	.donut::before { position: absolute; width: 98px; height: 98px; border-radius: 50%; background: white; content: ''; }
	.donut>div { z-index: 1; display: grid; justify-items: center; }
	.donut strong { font-size: 24px; line-height: 1.1; }
	.donut span { margin-top: 2px; color: var(--ui-muted); font-size: 13px; }
	.category-legend { flex: 1; min-width: 0; margin: 0; padding: 0; list-style: none; }
	.category-legend li { display: flex; align-items: center; gap: 8px; min-height: 28px; border-bottom: 1px solid #edf0f5; font-size: 12px; }
	.category-legend li:last-child { border: 0; }
	.category-legend i { width: 11px; height: 11px; flex: none; border-radius: 50%; background: var(--category-color); }
	.category-legend span { flex: 1; white-space: nowrap; }
	.category-legend strong { font-size: 12px; }
	.csat-panel, .insights-panel { min-height: 240px; padding: 14px 18px; }
	.text-link { display: flex; align-items: center; gap: 8px; color: #1943d3; font-size: 12px; white-space: nowrap; }
	.text-link span { font-size: 16px; }
	.csat-content { display: grid; grid-template-columns: 180px minmax(0, 1fr); align-items: center; min-height: 186px; }
	.csat-score { padding-right: 20px; border-right: 1px solid #edf0f5; }
	.csat-score>strong { font-size: 37px; letter-spacing: -1px; }
	.csat-score>strong small { color: var(--ui-muted); font-size: 15px; }
	.stars { margin: 2px 0 5px; color: #f5ae2d; font-size: 22px; letter-spacing: 2px; white-space: nowrap; }
	.csat-score p { margin: 0; color: var(--ui-muted); font-size: 12px; }
	.rating-bars { display: grid; gap: 9px; padding-left: 20px; }
	.rating-row { display: grid; grid-template-columns: 48px minmax(40px, 1fr) 32px; align-items: center; gap: 9px; color: var(--ui-muted); font-size: 12px; }
	.rating-row strong { color: var(--ui-text); font-size: 12px; font-weight: 500; }
	.rating-track { height: 11px; overflow: hidden; border-radius: 5px; background: #edf0f5; }
	.rating-track i { display: block; height: 100%; border-radius: 5px; }
	.rating-track .green { background: #16a477; }
	.rating-track .blue { background: #4383ef; }
	.rating-track .amber { background: #eba51b; }
	.rating-track .orange { background: #ef754d; }
	.rating-track .red { background: #e84c59; }
	.insights-panel .panel-heading h2 span { color: #5945ed; font-size: 21px; }
	.insight-list { display: grid; gap: 7px; margin-top: 10px; }
	.insight-list article { display: grid; grid-template-columns: 38px minmax(0, 1fr); align-items: center; gap: 10px; min-height: 55px; padding: 5px 9px; border-radius: 9px; background: #f7f9fc; }
	.insight-list article>i { display: grid; place-items: center; width: 34px; height: 34px; border-radius: 50%; background: white; font-size: 18px; font-style: normal; }
	.insight-list .danger { color: #df2547; }
	.insight-list .info { color: #2464dc; }
	.insight-list .success { color: #109866; }
	.insight-list article div { display: grid; gap: 1px; }
	.insight-list small { color: var(--ui-muted); font-size: 11px; }
	.insight-list strong { overflow: hidden; font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
	.insight-list p { overflow: hidden; margin: 0; color: var(--ui-muted); font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }
	.recent-panel { padding: 13px 16px 12px; }
	.recent-panel>.panel-heading { margin-bottom: 9px; }
	.table-scroll { overflow-x: auto; }
	table { width: 100%; border-collapse: collapse; white-space: nowrap; font-size: 12px; }
	thead { background: #f4f6fa; color: var(--ui-muted); }
	th { height: 32px; text-align: left; font-size: 11px; font-weight: 600; }
	td, th.ticket-id-cell { height: 38px; border-bottom: 1px solid #edf0f5; color: #40506c; }
	.ticket-id-cell { font-weight: 600; text-align: left; }
	tbody tr:last-child td, tbody tr:last-child th { border-bottom: 0; }
	.ticket-title { max-width: 280px; color: #283854; }
	.priority { min-width: 58px; justify-content: center; }
	.priority.high { background: var(--ui-danger-soft); color: var(--ui-danger); }
	.priority.medium { background: var(--ui-warning-soft); color: var(--ui-warning); }
	.priority.low { background: var(--ui-success-soft); color: var(--ui-success); }
	.assignee { display: inline-flex; align-items: center; gap: 8px; }
	.assignee i { display: inline-grid; place-items: center; width: 25px; height: 25px; border-radius: 50%; background: var(--avatar-color); color: white; font-size: 9px; font-style: normal; font-weight: 700; }
	.status { min-width: 70px; justify-content: center; }
	.status.in-progress { background: var(--ui-warning-soft); color: var(--ui-warning); }
	.status.waiting-on-user { background: #f3edff; color: #6744c8; }
	.status.resolved { background: var(--ui-success-soft); color: var(--ui-success); }
	@media (max-width: 1350px) {
		.dashboard { padding-right: 18px; padding-left: 18px; }
		.metric-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
		.analytics-grid, .summary-grid { grid-template-columns: minmax(0, 1.2fr) minmax(330px, 1fr); }
	}
	@media (max-width: 950px) {
		.dashboard { overflow: visible; }
		.analytics-grid, .summary-grid { grid-template-columns: 1fr; }
		.trend-panel, .category-panel { min-height: 250px; }
		.csat-panel, .insights-panel { min-height: 230px; }
	}
	@media (max-width: 700px) {
		.dashboard { padding: 16px 11px 20px; }
		.page-heading { margin-bottom: 14px; }
		.date-button { padding: 7px; font-size: 11px; }
		.metric-grid { gap: 8px; margin-bottom: 11px; }
		.metric-card { min-height: 100px; gap: 8px; padding: 10px 8px; }
		.metric-icon { width: 34px; height: 34px; font-size: 20px; }
		.metric-content p { font-size: 11px; }
		.metric-value { font-size: 22px; }
		.metric-change, .metric-caption { font-size: 11px; }
		.analytics-grid, .summary-grid { gap: 10px; margin-bottom: 10px; }
		.trend-panel { padding: 13px 10px; }
		.panel-heading h2 { font-size: 14px; }
		.panel-heading p { font-size: 12px; }
		.legend { gap: 7px; font-size: 11px; }
		.legend span { gap: 3px; }
		.legend i { width: 6px; height: 6px; }
		.category-panel { padding: 13px 10px; }
		.category-content { gap: 10px; padding-left: 0; }
		.donut { width: 118px; height: 118px; }
		.donut::before { width: 75px; height: 75px; }
		.category-legend li { min-height: 27px; gap: 6px; font-size: 11px; }
		.category-legend i { width: 9px; height: 9px; }
		.category-legend strong { font-size: 11px; }
		.csat-panel, .insights-panel { padding: 13px 10px; }
		.csat-content { grid-template-columns: 120px minmax(0, 1fr); }
		.csat-score { padding-right: 9px; }
		.csat-score>strong { font-size: 29px; }
		.stars { font-size: 16px; letter-spacing: 0; }
		.csat-score p { font-size: 11px; }
		.rating-bars { gap: 9px; padding-left: 9px; }
		.rating-row { grid-template-columns: 39px minmax(22px, 1fr) 28px; gap: 5px; font-size: 11px; }
		.rating-row strong { font-size: 11px; }
		.rating-track { height: 9px; }
		.recent-panel { padding: 11px 10px; }
		table { min-width: 580px; }
	}
</style>
