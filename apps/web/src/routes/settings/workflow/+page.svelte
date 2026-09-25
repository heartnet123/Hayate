<script lang="ts">
	let autoAssign = $state(true);
	let defaultQueue = $state('Tier 1 Support');
	let roundRobin = $state(true);
	let escalateUnassigned = $state(true);
	let escalateHours = $state('4');
	let notice = $state('');

	const save = () => {
		notice = 'Preview only. Workflow settings were not saved.';
		setTimeout(() => (notice = ''), 2500);
	};
</script>

<svelte:head>
	<title>Ticket Workflow | Settings | HelpDesk AI</title>
</svelte:head>

<div class="subpage-grid">
	<section class="ui-panel config-panel">
		<header class="panel-header">
			<div class="panel-icon blue" aria-hidden="true">▱</div>
			<div>
				<h2>Assignment Rules</h2>
				<p>Configure automated ticket routing and assignees.</p>
			</div>
		</header>

		<div class="panel-body">
			<div class="switch-row">
				<label for="sw-auto" id="lbl-auto" class="switch-copy">
					<strong>Auto-assign incoming tickets</strong>
					<small>Automatically dispatch new tickets based on skillset and workload.</small>
				</label>
				<button
					id="sw-auto"
					type="button"
					role="switch"
					aria-labelledby="lbl-auto"
					aria-checked={autoAssign}
					class="toggle-switch"
					class:checked={autoAssign}
					onclick={() => (autoAssign = !autoAssign)}
				>
					<span class="toggle-knob"></span>
				</button>
			</div>

			<div class="switch-row">
				<label for="sw-round" id="lbl-round" class="switch-copy">
					<strong>Round-robin distribution</strong>
					<small>Evenly distribute tickets across available team members.</small>
				</label>
				<button
					id="sw-round"
					type="button"
					role="switch"
					aria-labelledby="lbl-round"
					aria-checked={roundRobin}
					class="toggle-switch"
					class:checked={roundRobin}
					onclick={() => (roundRobin = !roundRobin)}
				>
					<span class="toggle-knob"></span>
				</button>
			</div>

			<div class="form-group">
				<label for="default-queue">Default Intake Queue</label>
				<select id="default-queue" class="ui-field select-field" bind:value={defaultQueue}>
					<option>Tier 1 Support</option>
					<option>Hardware Escalations</option>
					<option>Security & Compliance</option>
				</select>
			</div>
		</div>
	</section>

	<section class="ui-panel config-panel">
		<header class="panel-header">
			<div class="panel-icon blue" aria-hidden="true">⏱</div>
			<div>
				<h2>Escalation & Automation</h2>
				<p>Define triggers for tickets requiring urgent attention.</p>
			</div>
		</header>

		<div class="panel-body">
			<div class="switch-row">
				<label for="sw-esc" id="lbl-esc" class="switch-copy">
					<strong>Auto-escalate unassigned tickets</strong>
					<small>Alert manager if ticket unassigned past threshold.</small>
				</label>
				<button
					id="sw-esc"
					type="button"
					role="switch"
					aria-labelledby="lbl-esc"
					aria-checked={escalateUnassigned}
					class="toggle-switch"
					class:checked={escalateUnassigned}
					onclick={() => (escalateUnassigned = !escalateUnassigned)}
				>
					<span class="toggle-knob"></span>
				</button>
			</div>

			<div class="form-group">
				<label for="esc-time">Escalation Threshold (Hours)</label>
				<input id="esc-time" type="number" class="ui-field input-field" bind:value={escalateHours} />
			</div>

			<div class="panel-footer">
				<button type="button" class="ui-button ui-button-primary" onclick={save}>Save Workflow</button>
			</div>
		</div>
	</section>
</div>

{#if notice}
	<div class="toast-notice" role="alert">
		<span class="toast-dot" aria-hidden="true">!</span>
		<span>{notice}</span>
	</div>
{/if}

<style>
	.subpage-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
	.config-panel { padding: 18px 20px; }
	.panel-header { display: flex; align-items: flex-start; gap: 12px; margin-bottom: 16px; padding-bottom: 14px; border-bottom: 1px solid var(--ui-border); }
	.panel-icon { display: grid; place-items: center; width: 36px; height: 36px; border-radius: 8px; font-size: 18px; }
	.panel-icon.blue { background: var(--ui-primary-soft); color: var(--ui-primary); }
	.panel-header h2 { margin: 0; font-size: 15px; font-weight: 600; }
	.panel-header p { margin: 2px 0 0; color: var(--ui-muted); font-size: 12px; }
	.panel-body { display: flex; flex-direction: column; gap: 14px; }
	.switch-row { display: flex; align-items: center; justify-content: space-between; gap: 14px; cursor: pointer; }
	.switch-row strong { display: block; font-size: 12px; font-weight: 600; }
	.switch-row small { color: var(--ui-muted); font-size: 11px; }
	.form-group { display: flex; flex-direction: column; gap: 6px; }
	.form-group label { font-size: 12px; font-weight: 600; }
	.input-field, .select-field { width: 100%; padding: 7px 10px; font-size: 13px; }
	.toggle-switch { position: relative; width: 40px; height: 22px; flex: none; padding: 2px; border: 1px solid var(--ui-border); border-radius: 12px; background: #dce3ed; cursor: pointer; transition: background 200ms; }
	.toggle-switch.checked { border-color: var(--ui-primary); background: var(--ui-primary); }
	.toggle-knob { display: block; width: 16px; height: 16px; border-radius: 50%; background: white; transition: transform 200ms; }
	.toggle-switch.checked .toggle-knob { transform: translateX(18px); }
	.panel-footer { display: flex; justify-content: flex-end; margin-top: 6px; }
	.toast-notice { position: fixed; right: 24px; bottom: 24px; z-index: 60; display: flex; align-items: center; gap: 10px; padding: 10px 16px; border: 1px solid var(--ui-danger); border-radius: var(--ui-radius-sm); background: var(--ui-surface); color: var(--ui-text); font-size: 13px; }
	.toast-dot { display: grid; place-items: center; width: 18px; height: 18px; border-radius: 50%; background: var(--ui-danger-soft); color: var(--ui-danger); font-size: 11px; font-weight: 700; }
	@media (max-width: 900px) { .subpage-grid { grid-template-columns: 1fr; } }
</style>
