<section class="ui-panel config-card">
	<header class="card-header">
		<div class="card-icon blue" aria-hidden="true">ⓘ</div>
		<div class="card-heading-copy">
			<h2>System Information</h2>
			<p>Version, environment and maintenance details.</p>
		</div>
	</header>

	<div class="card-body">
		<div class="info-rows">
			<div class="info-row">
				<span>Application Version</span>
				<strong class="tabular-nums">v1.0.0</strong>
			</div>
			<div class="info-row">
				<span>Environment</span>
				<span class="ui-badge ui-badge-success">Production</span>
			</div>
			<div class="info-row">
				<span>Last Deployment</span>
				<strong class="tabular-nums">12 Jan 2024, 14:32</strong>
			</div>
			<div class="info-row">
				<span>Uptime</span>
				<strong class="tabular-nums">32 days, 4 hours</strong>
			</div>
		</div>

		<div class="operational-footer">
			<span class="status-pulse-dot" aria-hidden="true"></span>
			<strong>All systems operational</strong>
		</div>
	</div>
</section>

<style>
	.config-card {
		display: flex;
		flex-direction: column;
		padding: 18px 20px;
		background: var(--ui-surface);
	}

	.card-header {
		display: flex;
		align-items: flex-start;
		gap: 12px;
		margin-bottom: 16px;
		padding-bottom: 14px;
		border-bottom: 1px solid var(--ui-border);
	}

	.card-icon {
		display: grid;
		place-items: center;
		width: 36px;
		height: 36px;
		flex: none;
		border-radius: 8px;
		font-size: 18px;
	}
	.card-icon.blue {
		background: var(--ui-primary-soft);
		color: var(--ui-primary);
	}

	.card-heading-copy h2 {
		margin: 0;
		color: var(--ui-text);
		font-size: 15px;
		font-weight: 600;
		letter-spacing: -0.2px;
	}
	.card-heading-copy p {
		margin: 2px 0 0;
		color: var(--ui-muted);
		font-size: 12px;
		line-height: 1.4;
	}

	.card-body {
		display: flex;
		flex-direction: column;
		gap: 14px;
	}

	.info-rows {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	.info-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding-bottom: 10px;
		border-bottom: 1px solid var(--ui-border);
		font-size: 12px;
	}
	.info-row span {
		color: var(--ui-muted);
	}
	.info-row strong {
		color: var(--ui-text);
		font-weight: 600;
	}

	.operational-footer {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-top: 6px;
		color: var(--ui-success);
		font-size: 12px;
	}
	.status-pulse-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--ui-success);
		box-shadow: 0 0 0 3px var(--ui-success-soft);
	}
</style>
