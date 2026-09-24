<script lang="ts">
	import {
		dateFormatOptions,
		themeOptions,
		timeZoneOptions
	} from './settings-config';
	import type { SystemSettings } from './settings-config';

	let {
		form = $bindable(),
		onsubmit
	}: {
		form: SystemSettings;
		onsubmit: (event: SubmitEvent) => void;
	} = $props();
</script>

<section class="ui-panel config-card">
	<header class="card-header">
		<div class="card-icon blue" aria-hidden="true">🏢</div>
		<div class="card-heading-copy">
			<h2>Company & System</h2>
			<p>Basic information and system preferences.</p>
		</div>
	</header>

	<form class="card-body" {onsubmit}>
		<div class="form-group">
			<label for="company-name">Company Name</label>
			<input
				id="company-name"
				type="text"
				class="ui-field input-field"
				bind:value={form.companyName}
			/>
		</div>

		<div class="form-group">
			<label for="support-email">Support Email</label>
			<input
				id="support-email"
				type="email"
				class="ui-field input-field"
				bind:value={form.supportEmail}
			/>
		</div>

		<div class="form-row-2">
			<div class="form-group">
				<label for="time-zone">Time Zone</label>
				<div class="select-wrapper">
					<select id="time-zone" class="ui-field select-field" bind:value={form.timeZone}>
						{#each timeZoneOptions as opt}
							<option value={opt}>{opt}</option>
						{/each}
					</select>
					<span class="select-chevron" aria-hidden="true">⌄</span>
				</div>
			</div>

			<div class="form-group">
				<label for="date-format">Date Format</label>
				<div class="select-wrapper">
					<select id="date-format" class="ui-field select-field" bind:value={form.dateFormat}>
						{#each dateFormatOptions as opt}
							<option value={opt}>{opt}</option>
						{/each}
					</select>
					<span class="select-chevron" aria-hidden="true">⌄</span>
				</div>
			</div>
		</div>

		<div class="form-group">
			<label for="theme-select">Theme</label>
			<div class="select-wrapper">
				<select id="theme-select" class="ui-field select-field" bind:value={form.theme}>
					{#each themeOptions as opt}
						<option value={opt}>{opt}</option>
					{/each}
				</select>
				<span class="select-chevron" aria-hidden="true">⌄</span>
			</div>
		</div>

		<p class="field-hint">
			<span class="hint-icon" aria-hidden="true">ⓘ</span> These settings apply to your internal IT support instance only.
		</p>

		<div class="card-footer-action">
			<button type="submit" class="ui-button ui-button-primary">Save Changes</button>
		</div>
	</form>
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

	.input-field,
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

	.form-row-2 {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 12px;
	}

	.field-hint {
		display: flex;
		align-items: center;
		gap: 6px;
		margin: 4px 0 0;
		color: var(--ui-muted);
		font-size: 11px;
	}
	.hint-icon {
		font-size: 13px;
	}

	.card-footer-action {
		display: flex;
		justify-content: flex-end;
		margin-top: 8px;
	}

	@media (max-width: 768px) {
		.form-row-2 {
			grid-template-columns: 1fr;
		}
	}
</style>
