<script lang="ts">
	let botChannel = $state('#it-support');
	let autoReply = $state(true);
	let syncStatus = $state(true);
	let notifyOnEscalation = $state(true);
	let notice = $state('');

	const save = () => {
		notice = 'Preview only. Slack configuration was not saved.';
		setTimeout(() => (notice = ''), 2500);
	};
</script>

<svelte:head>
	<title>Slack Integration | Settings | HelpDesk AI</title>
</svelte:head>

<div class="subpage-grid">
	<section class="ui-panel config-panel">
		<header class="panel-header">
			<div class="panel-icon blue" aria-hidden="true">☷</div>
			<div>
				<h2>Workspace Connection</h2>
				<p>Manage bot permissions and ingestion channels.</p>
			</div>
		</header>

		<div class="panel-body">
			<div class="status-banner">
<span class="ui-badge">Sample only</span>
					<span>No Slack workspace connected.</span>
			</div>

			<div class="form-group">
				<label for="bot-ch">Primary Intake Channel</label>
				<select id="bot-ch" class="ui-field select-field" bind:value={botChannel}>
					<option>#it-support</option>
					<option>#general</option>
					<option>#helpdesk-triage</option>
				</select>
			</div>

			<div class="switch-row">
				<label for="sw-rep" id="lbl-rep" class="switch-copy">
					<strong>AI Bot thread auto-reply</strong>
					<small>Post AI suggested answers directly into thread.</small>
				</label>
				<button
					id="sw-rep"
					type="button"
					role="switch"
					aria-labelledby="lbl-rep"
					aria-checked={autoReply}
					class="toggle-switch"
					class:checked={autoReply}
					onclick={() => (autoReply = !autoReply)}
				>
					<span class="toggle-knob"></span>
				</button>
			</div>
		</div>
	</section>

	<section class="ui-panel config-panel">
		<header class="panel-header">
			<div class="panel-icon blue" aria-hidden="true">🔔</div>
			<div>
				<h2>Channel Sync & Alerts</h2>
				<p>Configure notifications broadcast to Slack channels.</p>
			</div>
		</header>

		<div class="panel-body">
			<div class="switch-row">
				<label for="sw-sync" id="lbl-sync" class="switch-copy">
					<strong>Two-way status sync</strong>
					<small>Update Slack message when ticket status changes.</small>
				</label>
				<button
					id="sw-sync"
					type="button"
					role="switch"
					aria-labelledby="lbl-sync"
					aria-checked={syncStatus}
					class="toggle-switch"
					class:checked={syncStatus}
					onclick={() => (syncStatus = !syncStatus)}
				>
					<span class="toggle-knob"></span>
				</button>
			</div>

			<div class="switch-row">
				<label for="sw-esc-notif" id="lbl-esc-notif" class="switch-copy">
					<strong>Escalation channel alerts</strong>
					<small>Ping #it-escalations on high-priority alerts.</small>
				</label>
				<button
					id="sw-esc-notif"
					type="button"
					role="switch"
					aria-labelledby="lbl-esc-notif"
					aria-checked={notifyOnEscalation}
					class="toggle-switch"
					class:checked={notifyOnEscalation}
					onclick={() => (notifyOnEscalation = !notifyOnEscalation)}
				>
					<span class="toggle-knob"></span>
				</button>
			</div>

			<div class="panel-footer">
				<button type="button" class="ui-button ui-button-primary" onclick={save}>Save Slack Settings</button>
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
	.status-banner { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border: 1px solid var(--ui-border); border-radius: var(--ui-radius-sm); background: var(--ui-surface-subtle); font-size: 12px; }
	.switch-row { display: flex; align-items: center; justify-content: space-between; gap: 14px; cursor: pointer; }
	.switch-row strong { display: block; font-size: 12px; font-weight: 600; }
	.switch-row small { color: var(--ui-muted); font-size: 11px; }
	.form-group { display: flex; flex-direction: column; gap: 6px; }
	.form-group label { font-size: 12px; font-weight: 600; }
	.select-field { width: 100%; padding: 7px 10px; font-size: 13px; }
	.toggle-switch { position: relative; width: 40px; height: 22px; flex: none; padding: 2px; border: 1px solid var(--ui-border); border-radius: 12px; background: #dce3ed; cursor: pointer; transition: background 200ms; }
	.toggle-switch.checked { border-color: var(--ui-primary); background: var(--ui-primary); }
	.toggle-knob { display: block; width: 16px; height: 16px; border-radius: 50%; background: white; transition: transform 200ms; }
	.toggle-switch.checked .toggle-knob { transform: translateX(18px); }
	.panel-footer { display: flex; justify-content: flex-end; margin-top: 6px; }
	.toast-notice { position: fixed; right: 24px; bottom: 24px; z-index: 60; display: flex; align-items: center; gap: 10px; padding: 10px 16px; border: 1px solid var(--ui-danger); border-radius: var(--ui-radius-sm); background: var(--ui-surface); color: var(--ui-text); font-size: 13px; }
	.toast-dot { display: grid; place-items: center; width: 18px; height: 18px; border-radius: 50%; background: var(--ui-danger-soft); color: var(--ui-danger); font-size: 11px; font-weight: 700; }
	@media (max-width: 900px) { .subpage-grid { grid-template-columns: 1fr; } }
</style>
