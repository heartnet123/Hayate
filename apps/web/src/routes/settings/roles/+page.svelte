<script lang="ts">
	let roles = [
		{ members: 2, name: 'Super Admin', permissions: 'Full system & billing access' },
		{ members: 5, name: 'Support Lead', permissions: 'Manage queues, rules & SLAs' },
		{ members: 14, name: 'Support Agent', permissions: 'View & resolve tickets' },
		{ members: 120, name: 'End User', permissions: 'Submit tickets & read KB' }
	];
	let notice = $state('');

	const inviteUser = () => {
		notice = 'Invite dialog opened.';
		setTimeout(() => (notice = ''), 2500);
	};
</script>

<svelte:head>
	<title>Roles & Permissions | Settings | HelpDesk AI</title>
</svelte:head>

<section class="ui-panel config-panel">
	<header class="panel-header">
		<div class="panel-icon blue" aria-hidden="true">👥</div>
		<div class="header-copy">
			<h2>Roles & Permissions</h2>
			<p>Define team access levels and security policies.</p>
		</div>
		<button type="button" class="ui-button ui-button-primary" onclick={inviteUser}>Invite Member</button>
	</header>

	<div class="table-wrap">
		<table class="roles-table">
			<thead>
				<tr>
					<th scope="col">Role</th>
					<th scope="col">Permissions</th>
					<th scope="col">Assigned Members</th>
					<th scope="col">Actions</th>
				</tr>
			</thead>
			<tbody>
				{#each roles as role}
					<tr>
						<td><strong>{role.name}</strong></td>
						<td><span class="perm-text">{role.permissions}</span></td>
						<td><span class="ui-badge tabular-nums">{role.members} users</span></td>
						<td><button type="button" class="ui-button-quiet edit-btn" aria-label={`Edit role ${role.name}`}>Edit</button></td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</section>

{#if notice}
	<div class="toast-notice" role="status">
		<span class="toast-dot" aria-hidden="true">✓</span>
		<span>{notice}</span>
	</div>
{/if}

<style>
	.config-panel { padding: 18px 20px; }
	.panel-header { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; padding-bottom: 14px; border-bottom: 1px solid var(--ui-border); }
	.panel-icon { display: grid; place-items: center; width: 36px; height: 36px; border-radius: 8px; font-size: 18px; background: var(--ui-primary-soft); color: var(--ui-primary); }
	.header-copy { flex: 1; }
	.header-copy h2 { margin: 0; font-size: 15px; font-weight: 600; }
	.header-copy p { margin: 2px 0 0; color: var(--ui-muted); font-size: 12px; }
	.table-wrap { overflow-x: auto; }
	.roles-table { width: 100%; border-collapse: collapse; font-size: 13px; text-align: left; }
	.roles-table th { padding: 10px 12px; border-bottom: 1px solid var(--ui-border); color: var(--ui-muted); font-size: 11px; font-weight: 600; text-transform: uppercase; }
	.roles-table td { padding: 12px; border-bottom: 1px solid var(--ui-border); }
	.perm-text { color: var(--ui-muted); font-size: 12px; }
	.edit-btn { font-size: 12px; cursor: pointer; }
	.toast-notice { position: fixed; right: 24px; bottom: 24px; z-index: 60; display: flex; align-items: center; gap: 10px; padding: 10px 16px; border: 1px solid var(--ui-success); border-radius: var(--ui-radius-sm); background: var(--ui-surface); color: var(--ui-text); font-size: 13px; }
	.toast-dot { display: grid; place-items: center; width: 18px; height: 18px; border-radius: 50%; background: var(--ui-success-soft); color: var(--ui-success); font-size: 11px; font-weight: 700; }
</style>
