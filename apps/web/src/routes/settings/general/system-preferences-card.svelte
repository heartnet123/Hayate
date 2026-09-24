<script lang="ts">
	import { categoryOptions, priorityOptions } from './settings-config';
	import type { SystemSettings } from './settings-config';

	let {
		form = $bindable()
	}: {
		form: SystemSettings;
	} = $props();
</script>

<section class="ui-panel config-card">
	<header class="card-header">
		<div class="card-icon blue" aria-hidden="true">⊶</div>
		<div class="card-heading-copy">
			<h2>System Preferences</h2>
			<p>Customize the helpdesk experience.</p>
		</div>
	</header>

	<div class="card-body">
		<div class="switch-list">
			<div class="switch-item">
				<label for="switch-ai" class="switch-copy">
					<strong id="label-ai">Enable AI suggested responses</strong>
					<small>Show AI-generated reply suggestions in ticket view.</small>
				</label>
				<button
					id="switch-ai"
					type="button"
					role="switch"
					aria-labelledby="label-ai"
					aria-checked={form.enableAiSuggestions}
					class="toggle-switch"
					class:checked={form.enableAiSuggestions}
					onclick={() => (form.enableAiSuggestions = !form.enableAiSuggestions)}
				>
					<span class="toggle-knob"></span>
				</button>
			</div>

			<div class="switch-item">
				<label for="switch-auto-create" class="switch-copy">
					<strong id="label-auto-create">Auto-create tickets from low-confidence chatbot answers</strong>
					<small>Create a ticket when AI confidence is below threshold.</small>
				</label>
				<button
					id="switch-auto-create"
					type="button"
					role="switch"
					aria-labelledby="label-auto-create"
					aria-checked={form.autoCreateTickets}
					class="toggle-switch"
					class:checked={form.autoCreateTickets}
					onclick={() => (form.autoCreateTickets = !form.autoCreateTickets)}
				>
					<span class="toggle-knob"></span>
				</button>
			</div>

			<div class="switch-item">
				<label for="switch-require-approval" class="switch-copy">
					<strong id="label-approval">Require approval for ticket closure</strong>
					<small>Open tickets can only be closed by a supervisor.</small>
				</label>
				<button
					id="switch-require-approval"
					type="button"
					role="switch"
					aria-labelledby="label-approval"
					aria-checked={form.requireApproval}
					class="toggle-switch"
					class:checked={form.requireApproval}
					onclick={() => (form.requireApproval = !form.requireApproval)}
				>
					<span class="toggle-knob"></span>
				</button>
			</div>

			<div class="switch-item">
				<label for="switch-directory" class="switch-copy">
					<strong id="label-directory">Show employee directory in ticket form</strong>
					<small>Allow selecting colleagues when creating a ticket.</small>
				</label>
				<button
					id="switch-directory"
					type="button"
					role="switch"
					aria-labelledby="label-directory"
					aria-checked={form.showDirectory}
					class="toggle-switch"
					class:checked={form.showDirectory}
					onclick={() => (form.showDirectory = !form.showDirectory)}
				>
					<span class="toggle-knob"></span>
				</button>
			</div>

			<div class="switch-item">
				<label for="switch-asset" class="switch-copy">
					<strong id="label-asset">Enable asset suggestions</strong>
					<small>Suggest relevant assets based on issue description.</small>
				</label>
				<button
					id="switch-asset"
					type="button"
					role="switch"
					aria-labelledby="label-asset"
					aria-checked={form.enableAssetSuggestions}
					class="toggle-switch"
					class:checked={form.enableAssetSuggestions}
					onclick={() => (form.enableAssetSuggestions = !form.enableAssetSuggestions)}
				>
					<span class="toggle-knob"></span>
				</button>
			</div>
		</div>

		<div class="form-row-2 pt-selects">
			<div class="form-group">
				<label for="default-category">Default Ticket Category</label>
				<div class="select-wrapper">
					<select
						id="default-category"
						class="ui-field select-field"
						bind:value={form.defaultCategory}
					>
						{#each categoryOptions as opt}
							<option value={opt}>{opt}</option>
						{/each}
					</select>
					<span class="select-chevron" aria-hidden="true">⌄</span>
				</div>
			</div>

			<div class="form-group">
				<label for="default-priority">Default Priority</label>
				<div class="select-wrapper">
					<select
						id="default-priority"
						class="ui-field select-field"
						bind:value={form.defaultPriority}
					>
						{#each priorityOptions as opt}
							<option value={opt}>{opt}</option>
						{/each}
					</select>
					<span class="select-chevron" aria-hidden="true">⌄</span>
				</div>
			</div>
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

	.switch-list {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.switch-item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 14px;
		cursor: pointer;
	}

	.switch-copy {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.switch-copy strong {
		color: var(--ui-text);
		font-size: 12px;
		font-weight: 600;
	}
	.switch-copy small {
		color: var(--ui-muted);
		font-size: 11px;
		line-height: 1.35;
	}

	.toggle-switch {
		position: relative;
		width: 40px;
		height: 22px;
		flex: none;
		padding: 2px;
		border: 1px solid var(--ui-border);
		border-radius: 12px;
		background: #dce3ed;
		cursor: pointer;
		transition: background-color 200ms ease, border-color 200ms ease;
	}
	.toggle-switch.checked {
		border-color: var(--ui-primary);
		background: var(--ui-primary);
	}
	.toggle-knob {
		display: block;
		width: 16px;
		height: 16px;
		border-radius: 50%;
		background: white;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
		transition: transform 200ms cubic-bezier(0.4, 0, 0.2, 1);
	}
	.toggle-switch.checked .toggle-knob {
		transform: translateX(18px);
	}

	.form-row-2 {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 12px;
	}
	.pt-selects {
		padding-top: 6px;
		border-top: 1px solid var(--ui-border);
	}

	.form-group {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.form-group label {
		color: var(--ui-text);
		font-size: 12px;
		font-weight: 600;
	}

	.select-field {
		width: 100%;
		padding: 7px 10px;
		font-size: 13px;
	}

	.select-wrapper {
		position: relative;
		display: flex;
		align-items: center;
		width: 100%;
	}
	.select-wrapper select {
		appearance: none;
		padding-right: 28px;
		cursor: pointer;
	}
	.select-chevron {
		position: absolute;
		right: 10px;
		color: var(--ui-muted);
		font-size: 15px;
		pointer-events: none;
	}

	@media (max-width: 768px) {
		.form-row-2 {
			grid-template-columns: 1fr;
		}
	}
</style>
