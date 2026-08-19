(() => {
    const THEME_KEY = "ecopixel_theme";
    const root = document.documentElement;
    const themeToggle = document.getElementById("theme-toggle");

    const setTheme = (theme) => {
        root.setAttribute("data-theme", theme);
        if (themeToggle) {
            const nextLabel = theme === "dark" ? "Переключить на светлую тему" : "Переключить на темную тему";
            themeToggle.setAttribute("aria-label", nextLabel);
            themeToggle.setAttribute("title", nextLabel);
        }
    };

    const currentTheme = root.getAttribute("data-theme") || "light";
    setTheme(currentTheme);

    themeToggle?.addEventListener("click", () => {
        const activeTheme = root.getAttribute("data-theme") || "light";
        const nextTheme = activeTheme === "dark" ? "light" : "dark";
        setTheme(nextTheme);
        try {
            localStorage.setItem(THEME_KEY, nextTheme);
        } catch (error) {
            // Ignore storage errors.
        }
    });

    const burger = document.querySelector(".burger");
    const mobileMenu = document.querySelector(".mobile-menu");
    burger?.addEventListener("click", () => mobileMenu?.classList.toggle("open"));

    const observer = new IntersectionObserver((entries) => {
        entries.forEach((e) => {
            if (e.isIntersecting) e.target.classList.add("visible");
        });
    }, { threshold: 0.1 });
    document.querySelectorAll(".animate-on-scroll").forEach((el) => observer.observe(el));

    document.querySelectorAll("[data-count]").forEach((el) => {
        const target = Number(el.dataset.count || 0);
        let current = 0;
        const step = target / 60 || 1;
        const timer = setInterval(() => {
            current += step;
            if (current >= target) {
                current = target;
                clearInterval(timer);
            }
            el.innerText = Math.floor(current).toString();
        }, 25);
    });

    document.querySelectorAll(".btn-ripple").forEach((btn) => {
        btn.addEventListener("click", function (e) {
            const circle = document.createElement("span");
            const diameter = Math.max(this.clientWidth, this.clientHeight);
            circle.style.width = `${diameter}px`;
            circle.style.height = `${diameter}px`;
            circle.style.left = `${e.clientX - this.getBoundingClientRect().left - diameter / 2}px`;
            circle.style.top = `${e.clientY - this.getBoundingClientRect().top - diameter / 2}px`;
            circle.classList.add("ripple");
            this.appendChild(circle);
            setTimeout(() => circle.remove(), 600);
        });
    });

    const toTopBtn = document.getElementById("to-top-btn");
    if (toTopBtn) {
        window.addEventListener("scroll", () => {
            toTopBtn.classList.toggle("visible", window.scrollY > 300);
        });
        toTopBtn.addEventListener("click", () => {
            window.scrollTo({ top: 0, behavior: "smooth" });
        });
    }
})();
