<script lang="ts">
	let {
		isRebuildingIndex,
		onrequestReset,
		onrebuildIndex
	}: {
		isRebuildingIndex: boolean;
		onrequestReset: () => void;
		onrebuildIndex: () => void;
	} = $props();
</script>

<section class="ui-panel config-card danger-card">
	<header class="card-header">
		<div class="card-icon red" aria-hidden="true">⚠</div>
		<div class="card-heading-copy">
			<h2 class="danger-title">Danger Zone</h2>
			<p>Preview-only actions; no data changes.</p>
		</div>
	</header>

	<div class="card-body">
		<div class="danger-row">
			<div class="danger-icon-cell red-bg" aria-hidden="true">⊝</div>
			<div class="danger-copy">
				<strong>Clear All Data</strong>
				<p>Preview only; system data is not deleted.</p>
			</div>
			<button
				type="button"
				class="ui-button danger-action-btn"
				onclick={onrequestReset}
			>
				Reset System
			</button>
		</div>

		<div class="danger-row">
			<div class="danger-icon-cell gray-bg" aria-hidden="true">↻</div>
			<div class="danger-copy">
				<strong>Rebuild Search Index</strong>
				<p>Rebuild the knowledge base search index. This may take a few minutes.</p>
			</div>
			<button
				type="button"
				class="ui-button secondary-danger-btn"
				disabled={isRebuildingIndex}
				aria-busy={isRebuildingIndex}
				onclick={onrebuildIndex}
			>
				{isRebuildingIndex ? 'Rebuilding...' : 'Rebuild Index'}
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
	.card-icon.red {
		background: var(--ui-danger-soft);
		color: var(--ui-danger);
	}

	.card-heading-copy h2.danger-title {
		margin: 0;
		color: var(--ui-danger);
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

	.danger-card {
		border-color: #fbd6da;
		background: #fffafa;
	}
	.danger-row {
		display: grid;
		grid-template-columns: 34px minmax(0, 1fr) auto;
		align-items: center;
		gap: 12px;
		padding: 12px;
		border: 1px solid #fae2e5;
		border-radius: var(--ui-radius-sm);
		background: var(--ui-surface);
	}
	.danger-icon-cell {
		display: grid;
		place-items: center;
		width: 32px;
		height: 32px;
		border-radius: 6px;
		font-size: 16px;
	}
	.danger-icon-cell.red-bg {
		background: var(--ui-danger-soft);
		color: var(--ui-danger);
	}
	.danger-icon-cell.gray-bg {
		background: var(--ui-surface-subtle);
		color: var(--ui-muted);
	}
	.danger-copy strong {
		display: block;
		color: var(--ui-text);
		font-size: 12px;
		font-weight: 600;
	}
	.danger-copy p {
		margin: 2px 0 0;
		color: var(--ui-muted);
		font-size: 11px;
		line-height: 1.35;
	}
	.danger-action-btn {
		border-color: var(--ui-danger);
		background: var(--ui-danger);
		color: white;
		font-size: 12px;
	}
	.danger-action-btn:hover:not(:disabled) {
		border-color: #b82b3a;
		background: #b82b3a;
		color: white;
	}
	.secondary-danger-btn {
		font-size: 12px;
	}

	@media (max-width: 768px) {
		.danger-row {
			grid-template-columns: 34px minmax(0, 1fr);
		}
		.danger-action-btn,
		.secondary-danger-btn {
			grid-column: 1 / -1;
			width: 100%;
		}
	}
</style>
