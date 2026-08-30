(() => {
    const reportBtn = document.getElementById("report-work-btn");
    const loginBtn = document.getElementById("report-login-btn");
    const dialog = document.getElementById("report-dialog");
    const form = document.getElementById("report-form");
    const commentInput = document.getElementById("report-comment");
    const cancelBtn = document.getElementById("report-cancel-btn");
    const messageEl = document.getElementById("report-message");

    function getCsrfToken() {
        const input = document.querySelector("input[name='csrfmiddlewaretoken']");
        return input ? input.value : "";
    }

    if (loginBtn) {
        loginBtn.addEventListener("click", () => {
            window.location.href = `/login/?next=${encodeURIComponent(window.location.pathname)}`;
        });
    }

    if (!reportBtn || !dialog || !form || !commentInput) {
        return;
    }

    reportBtn.addEventListener("click", () => {
        messageEl.textContent = "";
        dialog.showModal();
        commentInput.focus();
    });

    cancelBtn?.addEventListener("click", () => {
        dialog.close();
    });

    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const comment = commentInput.value.trim();
        if (!comment) {
            messageEl.textContent = "Напишите комментарий к жалобе.";
            return;
        }

        const submitBtn = document.getElementById("report-submit-btn");
        submitBtn.disabled = true;
        messageEl.textContent = "";

        try {
            const body = new URLSearchParams();
            body.set("comment", comment);
            const response = await fetch(`/report/${reportBtn.dataset.id}/`, {
                method: "POST",
                headers: {
                    "X-CSRFToken": getCsrfToken(),
                    "X-Requested-With": "XMLHttpRequest",
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                credentials: "same-origin",
                body: body.toString(),
            });

            let data = {};
            try {
                data = await response.json();
            } catch (error) {
                throw new Error("invalid_json");
            }

            if (response.status === 401) {
                window.location.href = `/login/?next=${encodeURIComponent(window.location.pathname)}`;
                return;
            }

            if (response.ok && data.success) {
                window.location.href = `${window.location.pathname}?report=sent`;
                return;
            }

            messageEl.textContent = data.error || "Ошибка, попробуйте позже";
        } catch (error) {
            messageEl.textContent = "Ошибка, попробуйте позже";
        } finally {
            submitBtn.disabled = false;
        }
    });
})();
