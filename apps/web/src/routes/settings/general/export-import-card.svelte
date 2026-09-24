<script lang="ts">
	let {
		onexport,
		onimport
	}: {
		onexport: (type: string) => void;
		onimport: () => void;
	} = $props();
</script>

<section class="ui-panel config-card">
	<header class="card-header">
		<div class="card-icon blue" aria-hidden="true">⤓</div>
		<div class="card-heading-copy">
			<h2>Export & Import</h2>
			<p>Manage your data and configurations.</p>
		</div>
	</header>

	<div class="card-body">
		<div class="action-list-row">
			<div class="action-row-copy">
				<strong>Export Data</strong>
				<p>Download tickets, knowledge base, and configuration files.</p>
			</div>
			<button
				type="button"
				class="ui-button transfer-btn"
				onclick={() => onexport('all system data')}
			>
				<span class="btn-icon" aria-hidden="true">⤓</span> Export Data
			</button>
		</div>

		<div class="action-list-row">
			<div class="action-row-copy">
				<strong>Import Knowledge Base</strong>
				<p>Import articles from Markdown or CSV files.</p>
			</div>
			<button
				type="button"
				class="ui-button transfer-btn"
				onclick={onimport}
			>
				<span class="btn-icon" aria-hidden="true">⤒</span> Import KB
			</button>
		</div>

		<div class="action-list-row">
			<div class="action-row-copy">
				<strong>Export Configuration</strong>
				<p>Download system settings and workflows.</p>
			</div>
			<button
				type="button"
				class="ui-button transfer-btn"
				onclick={() => onexport('configuration')}
			>
				<span class="btn-icon" aria-hidden="true">⤓</span> Export Config
			</button>
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

	.action-list-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding: 10px 0;
		border-bottom: 1px solid var(--ui-border);
	}
	.action-list-row:last-child {
		border-bottom: 0;
		padding-bottom: 0;
	}
	.action-row-copy strong {
		display: block;
		color: var(--ui-text);
		font-size: 12px;
		font-weight: 600;
	}
	.action-row-copy p {
		margin: 2px 0 0;
		color: var(--ui-muted);
		font-size: 11px;
	}
	.transfer-btn {
		gap: 6px;
		font-size: 12px;
		white-space: nowrap;
	}
	.btn-icon {
		font-size: 14px;
	}
</style>
