<script lang="ts">
	import SettingsTabs from './settings-tabs.svelte';

	const { children } = $props();
</script>

<main id="main-content" class="settings-shell">
	<header class="ui-page-heading page-header">
		<div>
			<h1>Settings</h1>
			<p>Only Roles & Permissions changes are saved. Other settings remain preview-only.</p>
		</div>
	</header>

	<SettingsTabs />

	{@render children()}
</main>

<style>
	.settings-shell {
		display: flex;
		flex-direction: column;
		min-width: 0;
		overflow-y: auto;
		padding: 16px 24px 32px;
		color: var(--ui-text);
	}

	.page-header {
		margin-bottom: 14px;
	}

	@media (max-width: 768px) {
		.settings-shell {
			padding: 12px 14px 24px;
		}
		.settings-shell :global(input),
		.settings-shell :global(select),
		.settings-shell :global(textarea) {
			font-size: 16px;
		}
	}
</style>
