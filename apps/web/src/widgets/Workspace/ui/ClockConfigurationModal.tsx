import {
    CLOCK_MAX_DUTY_CYCLE,
    CLOCK_MAX_FREQUENCY_HZ,
    CLOCK_MIN_DUTY_CYCLE,
    CLOCK_MIN_FREQUENCY_HZ,
    frequencyHzToPeriodMs,
    periodMsToFrequencyHz,
} from "../lib/clock-config";
import type { WorkspaceController } from "../lib/types";
import { Pusher } from "@gately/shared/ui";
import { Component, createEffect, createSignal, Show } from "solid-js";

type ClockConfigurationModalProps = {
    clock: WorkspaceController["clock"];
};

const modalButton =
    "inline-flex h-7 items-center justify-center rounded border border-gray-5 bg-gray-2 px-3 text-xs leading-none text-gray-12 hover:bg-gray-3 data-disabled:text-gray-8 data-disabled:hover:bg-gray-2";

const numberInput =
    "h-8 rounded border border-gray-5 bg-gray-1 px-2 text-sm text-gray-12 outline-none focus:border-primary-7";

const formatNumber = (value: number, digits = 2): string => {
    const rounded = Number(value.toFixed(digits));
    return String(rounded);
};

export const ClockConfigurationModal: Component<ClockConfigurationModalProps> = (props) => {
    let frequencyInput: HTMLInputElement | undefined;
    let periodInput: HTMLInputElement | undefined;
    let dutyInput: HTMLInputElement | undefined;
    const [frequencyDraft, setFrequencyDraft] = createSignal("");
    const [periodDraft, setPeriodDraft] = createSignal("");
    const [dutyDraft, setDutyDraft] = createSignal("");
    const [lastEditedRate, setLastEditedRate] = createSignal<"frequency" | "period">("frequency");
    const config = () => props.clock.editingConfig;
    const dutyPercent = () => config().dutyCycle * 100;
    const periodMs = () => frequencyHzToPeriodMs(config().frequencyHz);

    const syncDrafts = () => {
        setFrequencyDraft(formatNumber(config().frequencyHz, 3));
        setPeriodDraft(formatNumber(periodMs(), 0));
        setDutyDraft(formatNumber(dutyPercent(), 0));
    };

    createEffect(() => {
        if (!props.clock.editingNode) return;
        syncDrafts();
    });

    const updateFrequency = (value: string): boolean => {
        const frequencyHz = Number(value);
        if (!Number.isFinite(frequencyHz) || value.trim() === "") return false;
        props.clock.updateEditingConfig({ frequencyHz });
        return true;
    };

    const updatePeriod = (value: string): boolean => {
        const period = Number(value);
        if (!Number.isFinite(period) || value.trim() === "") return false;
        props.clock.updateEditingConfig({ frequencyHz: periodMsToFrequencyHz(period) });
        return true;
    };

    const updateDuty = (value: string): boolean => {
        const percent = Number(value);
        if (!Number.isFinite(percent) || value.trim() === "") return false;
        props.clock.updateEditingConfig({ dutyCycle: percent / 100 });
        return true;
    };

    const commitDrafts = () => {
        const currentFrequency = formatNumber(config().frequencyHz, 3);
        const currentPeriod = formatNumber(periodMs(), 0);
        const currentDuty = formatNumber(dutyPercent(), 0);
        const nextFrequency = (frequencyInput?.value ?? frequencyDraft()).trim();
        const nextPeriod = (periodInput?.value ?? periodDraft()).trim();
        const nextDuty = (dutyInput?.value ?? dutyDraft()).trim();
        const frequencyChanged = nextFrequency !== currentFrequency;
        const periodChanged = nextPeriod !== currentPeriod;

        if (periodChanged && (!frequencyChanged || lastEditedRate() === "period")) {
            updatePeriod(nextPeriod);
        } else if (frequencyChanged) {
            updateFrequency(nextFrequency);
        }

        if (nextDuty !== currentDuty) {
            updateDuty(nextDuty);
        }
    };

    const closeWithDrafts = () => {
        commitDrafts();
        props.clock.closeConfig();
    };

    return (
        <Show when={props.clock.editingNode}>
            <div
                aria-modal="true"
                class="absolute inset-0 z-[60] flex items-center justify-center bg-black/20 p-4"
                role="dialog"
                onClick={closeWithDrafts}
            >
                <section
                    class="w-full max-w-md border border-gray-5 bg-gray-1 shadow-xl"
                    onClick={(event) => event.stopPropagation()}
                >
                    <header class="flex items-center justify-between border-b border-gray-4 px-4 py-3">
                        <div>
                            <h2 class="text-base font-semibold text-gray-12">Clock</h2>
                            <p class="mt-1 text-xs text-gray-10">Configure this signal source.</p>
                        </div>
                        <Pusher
                            ariaLabel="Close clock settings"
                            class={`${modalButton} w-7 px-0`}
                            onClick={closeWithDrafts}
                        >
                            x
                        </Pusher>
                    </header>
                    <div class="grid gap-4 p-4">
                        <label class="flex items-start gap-3 text-sm text-gray-12">
                            <input
                                class="mt-1"
                                type="checkbox"
                                checked={config().enabled}
                                onChange={(event) =>
                                    props.clock.updateEditingConfig({
                                        enabled: event.currentTarget.checked,
                                    })
                                }
                            />
                            <span>
                                <span class="block font-medium">Enabled</span>
                                <span class="block text-xs text-gray-10">
                                    Runs while simulation is not paused.
                                </span>
                            </span>
                        </label>
                        <label class="grid gap-1 text-xs text-gray-10">
                            <span class="font-medium text-gray-11">Frequency</span>
                            <input
                                ref={frequencyInput}
                                class={numberInput}
                                inputmode="decimal"
                                min={CLOCK_MIN_FREQUENCY_HZ}
                                max={CLOCK_MAX_FREQUENCY_HZ}
                                step="0.1"
                                type="number"
                                value={frequencyDraft()}
                                onBlur={(event) => {
                                    if (!updateFrequency(event.currentTarget.value)) syncDrafts();
                                }}
                                onFocus={() => setLastEditedRate("frequency")}
                                onInput={(event) => {
                                    setLastEditedRate("frequency");
                                    setFrequencyDraft(event.currentTarget.value);
                                }}
                            />
                            <span>
                                {formatNumber(CLOCK_MIN_FREQUENCY_HZ, 3)} Hz to{" "}
                                {formatNumber(CLOCK_MAX_FREQUENCY_HZ, 1)} Hz
                            </span>
                        </label>
                        <label class="grid gap-1 text-xs text-gray-10">
                            <span class="font-medium text-gray-11">Period</span>
                            <input
                                ref={periodInput}
                                class={numberInput}
                                inputmode="decimal"
                                min="50"
                                max="60000"
                                step="50"
                                type="number"
                                value={periodDraft()}
                                onBlur={(event) => {
                                    if (!updatePeriod(event.currentTarget.value)) syncDrafts();
                                }}
                                onFocus={() => setLastEditedRate("period")}
                                onInput={(event) => {
                                    setLastEditedRate("period");
                                    setPeriodDraft(event.currentTarget.value);
                                }}
                            />
                            <span>Milliseconds per complete cycle.</span>
                        </label>
                        <label class="grid gap-1 text-xs text-gray-10">
                            <span class="font-medium text-gray-11">Duty cycle</span>
                            <input
                                ref={dutyInput}
                                class={numberInput}
                                inputmode="decimal"
                                min={CLOCK_MIN_DUTY_CYCLE * 100}
                                max={CLOCK_MAX_DUTY_CYCLE * 100}
                                step="1"
                                type="number"
                                value={dutyDraft()}
                                onBlur={(event) => {
                                    if (!updateDuty(event.currentTarget.value)) syncDrafts();
                                }}
                                onInput={(event) => setDutyDraft(event.currentTarget.value)}
                            />
                            <span>Percent of each cycle spent high.</span>
                        </label>
                    </div>
                    <footer class="flex justify-end gap-2 border-t border-gray-4 px-4 py-3">
                        <Pusher
                            class={modalButton}
                            onClick={() => {
                                props.clock.resetEditingConfig();
                                syncDrafts();
                            }}
                        >
                            Reset
                        </Pusher>
                        <Pusher class={modalButton} onClick={closeWithDrafts}>
                            Done
                        </Pusher>
                    </footer>
                </section>
            </div>
        </Show>
    );
};
