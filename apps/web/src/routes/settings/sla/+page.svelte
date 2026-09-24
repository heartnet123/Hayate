<script lang="ts">
	let policies = [
		{ name: 'Urgent Priority', resolutionTime: '2 hours', responseTime: '15 mins', tone: 'danger' },
		{ name: 'High Priority', resolutionTime: '8 hours', responseTime: '1 hour', tone: 'warning' },
		{ name: 'Medium Priority', resolutionTime: '24 hours', responseTime: '4 hours', tone: 'primary' },
		{ name: 'Low Priority', resolutionTime: '48 hours', responseTime: '8 hours', tone: 'muted' }
	];
	let notice = $state('');

	const addPolicy = () => {
		notice = 'New SLA policy modal opened.';
		setTimeout(() => (notice = ''), 2500);
	};
</script>

<svelte:head>
	<title>SLA Policies | Settings | HelpDesk AI</title>
</svelte:head>

<section class="ui-panel config-panel">
	<header class="panel-header">
		<div class="panel-icon blue" aria-hidden="true">⏱</div>
		<div class="header-copy">
			<h2>SLA Policies</h2>
			<p>Configure response and resolution targets by priority level.</p>
		</div>
		<button type="button" class="ui-button ui-button-primary" onclick={addPolicy}>Add Policy</button>
	</header>

	<div class="table-wrap">
		<table class="sla-table">
			<thead>
				<tr>
					<th scope="col">Policy Tier</th>
					<th scope="col">Target First Response</th>
					<th scope="col">Target Resolution</th>
					<th scope="col">Actions</th>
				</tr>
			</thead>
			<tbody>
				{#each policies as policy}
					<tr>
						<td>
							<span class="policy-name">
								<span class="policy-bullet {policy.tone}" aria-hidden="true"></span>
								<strong>{policy.name}</strong>
							</span>
						</td>
						<td><span class="ui-badge tabular-nums">{policy.responseTime}</span></td>
						<td><span class="ui-badge ui-badge-success tabular-nums">{policy.resolutionTime}</span></td>
						<td><button type="button" class="ui-button-quiet edit-btn" aria-label={`Edit ${policy.name} policy`}>Edit</button></td>
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
	.sla-table { width: 100%; border-collapse: collapse; font-size: 13px; text-align: left; }
	.sla-table th { padding: 10px 12px; border-bottom: 1px solid var(--ui-border); color: var(--ui-muted); font-size: 11px; font-weight: 600; text-transform: uppercase; }
	.sla-table td { padding: 12px; border-bottom: 1px solid var(--ui-border); }
	.policy-name { display: flex; align-items: center; gap: 8px; }
	.policy-bullet { width: 8px; height: 8px; border-radius: 50%; }
	.policy-bullet.danger { background: var(--ui-danger); }
	.policy-bullet.warning { background: var(--ui-warning); }
	.policy-bullet.primary { background: var(--ui-primary); }
	.policy-bullet.muted { background: var(--ui-muted); }
	.edit-btn { font-size: 12px; cursor: pointer; }
	.toast-notice { position: fixed; right: 24px; bottom: 24px; z-index: 60; display: flex; align-items: center; gap: 10px; padding: 10px 16px; border: 1px solid var(--ui-success); border-radius: var(--ui-radius-sm); background: var(--ui-surface); color: var(--ui-text); font-size: 13px; }
	.toast-dot { display: grid; place-items: center; width: 18px; height: 18px; border-radius: 50%; background: var(--ui-success-soft); color: var(--ui-success); font-size: 11px; font-weight: 700; }
</style>
