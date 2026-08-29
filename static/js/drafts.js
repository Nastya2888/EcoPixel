(() => {
    const DRAFTS_KEY = "ecopixel_drafts";
    const LEGACY_DRAFT_KEY = "ecopixel_draft";
    const MAX_DRAFTS = 6;

    function createId() {
        if (window.crypto?.randomUUID) return window.crypto.randomUUID();
        return `draft-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    }

    function emptyStore() {
        return { activeId: null, items: [] };
    }

    function readStore() {
        try {
            const raw = localStorage.getItem(DRAFTS_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed && Array.isArray(parsed.items)) {
                    return {
                        activeId: parsed.activeId || null,
                        items: parsed.items.filter((item) => item && item.id && item.image),
                    };
                }
            }
        } catch (error) {
            // Fall through to legacy migration.
        }

        try {
            const legacy = localStorage.getItem(LEGACY_DRAFT_KEY);
            if (legacy) {
                const id = createId();
                const store = {
                    activeId: id,
                    items: [
                        {
                            id,
                            image: legacy,
                            width: 32,
                            height: 32,
                            updatedAt: Date.now(),
                        },
                    ],
                };
                writeStore(store);
                localStorage.removeItem(LEGACY_DRAFT_KEY);
                return store;
            }
        } catch (error) {
            // Ignore.
        }

        return emptyStore();
    }

    function writeStore(store) {
        const next = {
            activeId: store.activeId || null,
            items: (store.items || []).slice(0, MAX_DRAFTS),
        };
        localStorage.setItem(DRAFTS_KEY, JSON.stringify(next));
        return next;
    }

    function listDrafts() {
        return readStore().items.slice().sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    }

    function getDraft(id) {
        return readStore().items.find((item) => item.id === id) || null;
    }

    function getLatestDraft() {
        return listDrafts()[0] || null;
    }

    function upsertDraft({ id, image, width, height }) {
        if (!image) return null;
        const store = readStore();
        const draftId = id || store.activeId || createId();
        const existingIndex = store.items.findIndex((item) => item.id === draftId);
        const item = {
            id: draftId,
            image,
            width: Number(width) || 32,
            height: Number(height) || 32,
            updatedAt: Date.now(),
        };
        if (existingIndex >= 0) {
            store.items[existingIndex] = item;
        } else {
            store.items.unshift(item);
        }
        store.items = store.items
            .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
            .slice(0, MAX_DRAFTS);
        store.activeId = draftId;
        writeStore(store);
        return item;
    }

    function removeDraft(id) {
        const store = readStore();
        store.items = store.items.filter((item) => item.id !== id);
        if (store.activeId === id) {
            store.activeId = store.items[0]?.id || null;
        }
        writeStore(store);
    }

    function clearActiveDraft(id) {
        if (id) removeDraft(id);
    }

    function setActiveDraft(id) {
        const store = readStore();
        if (!store.items.some((item) => item.id === id)) return;
        store.activeId = id;
        writeStore(store);
    }

    window.EcoPixelDrafts = {
        MAX_DRAFTS,
        createId,
        listDrafts,
        getDraft,
        getLatestDraft,
        upsertDraft,
        removeDraft,
        clearActiveDraft,
        setActiveDraft,
    };
})();
