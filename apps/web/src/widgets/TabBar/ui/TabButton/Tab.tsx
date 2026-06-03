import { Component } from "solid-js";
import { TabClose } from "./TabClose";
import { TabProvider, useTabCtx } from "./TabProvider";
import TabTitleInput from "./TabTitleInput";
import { TabContextMenu } from "../TabContextMenu/TabContextMenu";
import { UIEngineTab } from "@gately/shared/infrastructure";
import { Tabs } from "@kobalte/core/tabs";
import { tabBarStyles as styles } from "../styles";
import { useOpenNewTab } from "@gately/features/tabs/useOpenTab";
import { isLeftButton } from "@gately/shared/lib/whatButtonClicked";

const InnerTab: Component = () => {
    const ctx = useTabCtx();
    const { openTab } = useOpenNewTab();
    let lastRenamePointerDownAt = 0;

    const handleTabWrapperPointerDown = (e: PointerEvent) => {
        if (!isLeftButton(e)) return;

        const target = e.target instanceof HTMLElement ? e.target : undefined;
        if (target?.closest("[aria-label='Close tab']")) return;

        const now = performance.now();
        if (now - lastRenamePointerDownAt < 450) {
            e.preventDefault();
            ctx.setIsTitleEditing(true);
            lastRenamePointerDownAt = 0;
            return;
        }

        lastRenamePointerDownAt = now;
    };

    return (
        <TabContextMenu>
            <div
                class={styles.tab.wrap()}
                onPointerDown={handleTabWrapperPointerDown}
                onPointerEnter={() => ctx.setIsHovered(true)}
                onPointerLeave={() => ctx.setIsHovered(false)}
            >
                <Tabs.Trigger
                    onDblClick={(e) => {
                        e.stopPropagation();
                        ctx.setIsTitleEditing(true);
                    }}
                    onPointerDown={(e) => {
                        if (!isLeftButton(e)) return;
                        if (e.detail > 1) {
                            e.preventDefault();
                            e.stopPropagation();
                            ctx.setIsTitleEditing(true);
                            return;
                        }

                        openTab(ctx.tab().id);
                    }}
                    value={ctx.tab().id}
                    class={styles.tab.trigger()}
                >
                    <span class={styles.tab.title()}>
                        <TabTitleInput />
                    </span>
                </Tabs.Trigger>
                <TabClose />
            </div>
        </TabContextMenu>
    );
};

export const Tab: Component<{ tab: UIEngineTab }> = (props) => (
    <TabProvider tab={props.tab}>
        <InnerTab />
    </TabProvider>
);
