<script lang="ts">
	import { page } from '$app/state';
	import '../app.css';

	let { children, data } = $props();
	const navItems = [
		{ count: '', href: '/', icon: '⌂', label: 'Dashboard' },
		{ count: '12', href: null, icon: '▱', label: 'Tickets' },
		{ count: '', href: '/slack', icon: '☷', label: 'Slack Intake' },
		{ count: '', href: null, icon: '▤', label: 'KB Chatbot' },
		{ count: '', href: null, icon: '◫', label: 'Knowledge Base' },
		{ count: '', href: '/sop', icon: '▧', label: 'SOP Drafts' },
		{ count: '', href: null, icon: '▥', label: 'Analytics' },
		{ count: '', href: '/settings', icon: '⚙', label: 'Settings' }
	];

	let currentPath = $derived(page.url.pathname);
</script>

<a class="skip-link" href="#main-content">Skip to content</a>
{#if data.user}
<div class="app-shell">
	<header class="topbar">
		<a class="brand" href="/" aria-label="HelpDesk AI home"><span class="brand-mark">✦</span><span>HelpDesk AI</span></a>
		<div class="search-wrap" role="search"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.4" /><path d="m16 16 4.2 4.2" /></svg><span>Search preview unavailable</span></div>
		<div class="top-actions"><span class="system-status">{data.slack?.workspace ? `${data.slack.workspace} (${data.slack.channel})` : 'Sample workspace'}</span><span class="profile-copy"><strong>{data.user.email}</strong><small>{data.user.role === 'admin' ? 'Admin' : 'Support agent'}</small></span><form method="POST" action="/logout"><button type="submit" class="ui-button ui-button-quiet">Sign out</button></form></div>
	</header>

	<div class="workspace">
		<aside class="sidebar">
			<nav aria-label="Main navigation" class="main-nav">
				{#each navItems as item}
					{#if item.href && (item.href !== '/settings' || data.user.role === 'admin')}
						<a href={item.href} aria-label={item.label} class:active={currentPath === item.href || (item.href === '/settings' && currentPath.startsWith('/settings'))} aria-current={(currentPath === item.href || (item.href === '/settings' && currentPath.startsWith('/settings'))) ? 'page' : undefined}><span class="nav-icon" aria-hidden="true">{item.icon}</span><span>{item.label}</span>{#if item.count}<span class="nav-count tabular-nums">{item.count}</span>{/if}</a>
					{:else if !item.href}
						<span class="nav-placeholder" title="{item.label} (coming soon)"><span class="nav-icon" aria-hidden="true">{item.icon}</span><span>{item.label}</span>{#if item.count}<span class="nav-count tabular-nums">{item.count}</span>{/if}</span>
					{/if}
				{/each}
			</nav>
			<section class="upgrade-card"><span class="upgrade-spark">✦</span><h2>Upgrade to Pro</h2><p>Unlock advanced AI insights and automation.</p></section>
		</aside>

		{@render children()}
	</div>
</div>
{:else}
	{@render children()}
{/if}
