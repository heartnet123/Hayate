<script lang="ts">
	import AppearanceBrandingCard from './appearance-branding-card.svelte';
	import CompanySystemCard from './company-system-card.svelte';
	import DangerZoneCard from './danger-zone-card.svelte';
	import ExportImportCard from './export-import-card.svelte';
	import { defaultSettings } from './settings-config';
	import type { SystemSettings } from './settings-config';
	import SystemInformationCard from './system-information-card.svelte';
	import SystemPreferencesCard from './system-preferences-card.svelte';

	let toastMessage = $state('');
	let showResetConfirm = $state(false);
	let isRebuildingIndex = $state(false);

	let form = $state<SystemSettings>({ ...defaultSettings });

	const showToast = (msg: string) => {
		toastMessage = msg;
		setTimeout(() => {
			toastMessage = '';
		}, 3000);
	};

	const handleSave = (event: SubmitEvent) => {
		event.preventDefault();
		showToast('Settings saved successfully.');
	};

	const triggerRebuildIndex = () => {
		isRebuildingIndex = true;
		setTimeout(() => {
			isRebuildingIndex = false;
			showToast('Search index rebuilt successfully.');
		}, 1200);
	};

	const triggerResetSystem = () => {
		showResetConfirm = false;
		showToast('System data reset successfully.');
	};

	const handleExport = (type: string) => {
		showToast(`Exported ${type} configuration.`);
	};

	const handleImport = () => {
		showToast('Knowledge base import initiated.');
	};
</script>

<svelte:window onkeydown={(e) => { if (e.key === 'Escape' && showResetConfirm) showResetConfirm = false; }} />

<svelte:head>
	<title>General Settings | HelpDesk AI</title>
	<meta name="description" content="Company info, system preferences, and branding." />
</svelte:head>

<div class="settings-grid" inert={showResetConfirm}>
	<CompanySystemCard bind:form onsubmit={handleSave} />
	<SystemPreferencesCard bind:form />
	<AppearanceBrandingCard bind:form onchangeLogo={() => showToast('Logo picker opened.')} />
	<SystemInformationCard />
	<DangerZoneCard
		{isRebuildingIndex}
		onrequestReset={() => (showResetConfirm = true)}
		onrebuildIndex={triggerRebuildIndex}
	/>
	<ExportImportCard onexport={handleExport} onimport={handleImport} />
</div>

<!-- Confirmation Modal for Reset System -->
{#if showResetConfirm}
	<div
		class="modal-backdrop"
		role="dialog"
		aria-modal="true"
		aria-labelledby="modal-title"
		tabindex="-1"
		onclick={(e) => { if (e.target === e.currentTarget) showResetConfirm = false; }}
		onkeydown={(e) => { if (e.key === 'Escape') showResetConfirm = false; }}
	>
		<div class="modal-content ui-panel">
			<div class="modal-header">
				<span class="modal-icon red" aria-hidden="true">⚠</span>
				<h3 id="modal-title">Reset Entire System?</h3>
			</div>
			<p class="modal-body">
				Are you absolutely sure? This will delete all tickets, user associations, and uploaded documents. This operation cannot be reversed.
			</p>
			<div class="modal-footer">
				<button type="button" class="ui-button" autofocus onclick={() => (showResetConfirm = false)}>
					Cancel
				</button>
				<button type="button" class="ui-button danger-action-btn" onclick={triggerResetSystem}>
					Reset All Data
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- Toast Notification -->
{#if toastMessage}
	<div class="toast-notice" role="status">
		<span class="toast-dot" aria-hidden="true">✓</span>
		<span>{toastMessage}</span>
	</div>
{/if}

<style>
	/* 3-Column Responsive Grid */
	.settings-grid {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 16px;
		align-items: start;
	}

	/* Confirmation Modal */
	.modal-backdrop {
		position: fixed;
		inset: 0;
		z-index: 50;
		display: grid;
		place-items: center;
		padding: 16px;
		background: rgba(18, 25, 43, 0.45);
		backdrop-filter: blur(2px);
		overscroll-behavior: contain;
	}
	.modal-content {
		width: min(100%, 420px);
		padding: 24px;
		border-radius: var(--ui-radius);
		background: var(--ui-surface);
		box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
	}
	.modal-header {
		display: flex;
		align-items: center;
		gap: 10px;
		margin-bottom: 12px;
	}
	.modal-icon {
		display: grid;
		place-items: center;
		width: 32px;
		height: 32px;
		border-radius: 8px;
		background: var(--ui-danger-soft);
		color: var(--ui-danger);
		font-size: 18px;
	}
	.modal-header h3 {
		margin: 0;
		font-size: 17px;
	}
	.modal-body {
		margin: 0 0 20px;
		color: var(--ui-muted);
		font-size: 13px;
		line-height: 1.5;
	}
	.modal-footer {
		display: flex;
		justify-content: flex-end;
		gap: 10px;
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

	/* Toast */
	.toast-notice {
		position: fixed;
		right: 24px;
		bottom: 24px;
		z-index: 60;
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 10px 16px;
		border: 1px solid var(--ui-success);
		border-radius: var(--ui-radius-sm);
		background: var(--ui-surface);
		color: var(--ui-text);
		font-size: 13px;
		box-shadow: 0 4px 12px rgba(20, 132, 84, 0.15);
	}
	.toast-dot {
		display: grid;
		place-items: center;
		width: 18px;
		height: 18px;
		border-radius: 50%;
		background: var(--ui-success-soft);
		color: var(--ui-success);
		font-size: 11px;
		font-weight: 700;
	}

	/* Responsive Media Queries */
	@media (max-width: 1250px) {
		.settings-grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}

	@media (max-width: 768px) {
		.settings-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
