import { onMount } from "solid-js";
import type { Component, JSX } from "solid-js";
import "reflect-metadata";
import { AppProvider } from "./providers/AppProvider";
import { useAppConfiguration } from "./providers/AppConfigurationProvider";
import { TabBar } from "@gately/widgets/TabBar";
import { Workspace } from "@gately/widgets/Workspace";

const AppContent: Component = () => {
    const configuration = useAppConfiguration();
    const signalPathStyle = (): JSX.CSSProperties => ({
        "--color-signal-high": configuration.signalPathColors().high,
        "--color-signal-low": configuration.signalPathColors().low,
    });

    return (
        <div class="flex h-full w-full flex-col overflow-hidden" style={signalPathStyle()}>
            <div
                class="shrink-0"
                style={{
                    zoom: configuration.uiScale(),
                }}
            >
                <TabBar />
            </div>
            <div class="min-h-0 flex-1">
                <Workspace />
            </div>
        </div>
    );
};

export const App: Component = () => {
    onMount(async () => {
        document.getElementById("initial-loader")?.remove();
    });

    return (
        <AppProvider>
            <AppContent />
        </AppProvider>
    );
};
