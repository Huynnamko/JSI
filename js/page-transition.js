(() => {
    const destinationKey = "wefo-page-transition-destination";

    try {
        if (sessionStorage.getItem(destinationKey) === window.location.href) {
            sessionStorage.removeItem(destinationKey);
            document.documentElement.classList.add("page-enter");
        }
    } catch {}

    document.addEventListener("click", (event) => {
        const anchor = event.target instanceof Element
            ? event.target.closest("a[href]")
            : null;

        if (!anchor || event.defaultPrevented || event.button !== 0
            || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey
            || (anchor.target && anchor.target.toLowerCase() !== "_self")
            || anchor.hasAttribute("download")) {
            return;
        }

        const destination = new URL(anchor.href, window.location.href);
        if (destination.origin !== window.location.origin
            || (destination.pathname === window.location.pathname
                && destination.search === window.location.search)) {
            return;
        }

        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
            return;
        }

        event.preventDefault();

        try {
            sessionStorage.setItem(destinationKey, destination.href);
        } catch {}

        document.documentElement.classList.add("page-leaving");
        window.setTimeout(() => window.location.assign(destination.href), 180);
    });
})();