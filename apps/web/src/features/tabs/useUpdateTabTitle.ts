import { useUIEngine } from "@gately/shared/infrastructure";

export const useUpdateTabTitle = () => {
    const uiEngine = useUIEngine();

    const updateTabTitle = (tabId: string, title: string) => {
        uiEngine.commands.renameScope(tabId, title);
    };

    return { updateTabTitle };
};
