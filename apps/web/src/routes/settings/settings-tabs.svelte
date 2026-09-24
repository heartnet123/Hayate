<script lang="ts">
	import { page } from '$app/state';

	const tabs = [
		{ href: '/settings/general', icon: '⚙', label: 'General' },
		{ href: '/settings/workflow', icon: '▱', label: 'Ticket Workflow' },
		{ href: '/settings/slack', icon: '☷', label: 'Slack Integration' },
		{ href: '/settings/ai', icon: '✦', label: 'AI Automation' },
		{ href: '/settings/knowledge-base', icon: '◫', label: 'Knowledge Base' },
		{ href: '/settings/notifications', icon: '🔔', label: 'Notifications' },
		{ href: '/settings/roles', icon: '👥', label: 'Roles & Permissions' },
		{ href: '/settings/sla', icon: '⏱', label: 'SLA Policies' }
	];

	let currentPath = $derived(page.url.pathname);
</script>

<nav class="settings-tabs" aria-label="Settings sections">
	{#each tabs as tab}
		<a
			href={tab.href}
			class="tab-link"
			class:active={currentPath === tab.href || (tab.href === '/settings/general' && currentPath === '/settings')}
			aria-current={(currentPath === tab.href || (tab.href === '/settings/general' && currentPath === '/settings')) ? 'page' : undefined}
		>
			<span class="tab-icon" aria-hidden="true">{tab.icon}</span>
			<span>{tab.label}</span>
		</a>
	{/each}
</nav>

<style>
	.settings-tabs {
		display: flex;
		align-items: center;
		gap: 6px;
		margin-bottom: 20px;
		padding-bottom: 6px;
		border-bottom: 1px solid var(--ui-border);
		overflow-x: auto;
	}

	.tab-link {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		height: 38px;
		padding: 0 14px;
		border: 0;
		border-bottom: 2px solid transparent;
		border-radius: var(--ui-radius-sm) var(--ui-radius-sm) 0 0;
		background: transparent;
		color: var(--ui-muted);
		font-size: 13px;
		font-weight: 500;
		white-space: nowrap;
		text-decoration: none;
		transition: color 150ms ease, background-color 150ms ease, border-color 150ms ease;
	}
	.tab-link:hover {
		color: var(--ui-text);
		background: var(--ui-surface-subtle);
	}
	.tab-link.active {
		border-bottom-color: var(--ui-primary);
		background: var(--ui-surface);
		color: var(--ui-primary);
		font-weight: 600;
	}
	.tab-icon {
		font-size: 14px;
	}
</style>
