(() => {
    const HEART_PATH =
        "M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z";

    const FILLED_HEART = `<svg class="icon-heart-filled" width="20" height="20" viewBox="0 0 24 24" fill="#E74C3C" stroke="#E74C3C" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${HEART_PATH}"/></svg>`;
    const EMPTY_HEART = `<svg class="icon-heart" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${HEART_PATH}"/></svg>`;
    const INLINE_HEART = `<svg class="icon-heart-inline" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${HEART_PATH}"/></svg>`;

    const I18N = window.ECOPIXEL_I18N || {};
    const LABEL_VOTE = I18N.vote || "Голосовать";
    const LABEL_VOTE_DETAIL = I18N.voteDetail || "Проголосовать";
    const LABEL_REMOVE = I18N.removeVote || "Убрать голос";

    function getCsrfToken() {
        const input = document.querySelector("input[name='csrfmiddlewaretoken']");
        return input ? input.value : "";
    }

    function setVoteButtonLabel(button, text, withHeart = false) {
        if (withHeart) {
            button.innerHTML = `<span class="vote-btn-label">${INLINE_HEART}<span>${text}</span></span>`;
            return;
        }
        button.textContent = text;
    }

    function isVotedButton(button) {
        return (
            button.dataset.voted === "true" ||
            button.classList.contains("voted") ||
            button.textContent.includes(LABEL_REMOVE) ||
            button.textContent.includes("Убрать голос") ||
            button.textContent.toLowerCase().includes("проголосовали")
        );
    }

    function unlockVoteButton(button) {
        if (!button.disabled || button.textContent.includes("Войти") || button.textContent.includes("Log in")) {
            return;
        }
        if (isVotedButton(button)) {
            button.disabled = false;
            button.dataset.voted = "true";
            button.classList.add("voted");
            setVoteButtonLabel(button, LABEL_REMOVE);
        }
    }

    function resolveVotedState(button, data) {
        if (typeof data.voted === "boolean") {
            return data.voted;
        }
        return button.dataset.voted !== "true";
    }

    async function postVote(drawingId) {
        const response = await fetch(`/vote/${drawingId}/`, {
            method: "POST",
            headers: {
                "X-CSRFToken": getCsrfToken(),
                "X-Requested-With": "XMLHttpRequest",
            },
            credentials: "same-origin",
        });

        let data = {};
        try {
            data = await response.json();
        } catch (error) {
            throw new Error("invalid_json");
        }

        return { response, data };
    }

    function applyGalleryVoteState(button, card, voted, votes) {
        const counter = card ? card.querySelector(".votes-count") : null;
        const heart = card ? card.querySelector("[data-heart]") : null;

        if (counter && typeof votes === "number") {
            counter.textContent = String(votes);
        }
        if (heart) {
            heart.innerHTML = voted ? FILLED_HEART : EMPTY_HEART;
            heart.animate(
                [{ transform: "scale(1)" }, { transform: "scale(1.4)" }, { transform: "scale(1)" }],
                { duration: 220 }
            );
        }

        button.dataset.voted = voted ? "true" : "false";
        button.classList.toggle("voted", voted);
        setVoteButtonLabel(button, voted ? LABEL_REMOVE : LABEL_VOTE, !voted);
    }

    document.querySelectorAll(".vote-btn").forEach((button) => {
        button.type = "button";
        unlockVoteButton(button);

        if (button.disabled) {
            if (button.textContent.includes("Войти") || button.textContent.includes("Log in")) {
                button.disabled = false;
                button.addEventListener("click", () => {
                    window.location.href = `/login/?next=${encodeURIComponent(window.location.pathname)}`;
                });
            }
            return;
        }

        button.addEventListener("click", async () => {
            if (button.dataset.voting === "true") {
                return;
            }

            button.dataset.voting = "true";
            button.disabled = true;
            const card = button.closest(".work-card");

            try {
                const { response, data } = await postVote(button.dataset.id);

                if (response.status === 401) {
                    window.location.href = `/login/?next=${encodeURIComponent(window.location.pathname)}`;
                    return;
                }

                if (response.ok && data.success) {
                    applyGalleryVoteState(button, card, resolveVotedState(button, data), data.votes);
                    return;
                }

                alert(data.error || "Ошибка, попробуйте позже");
            } catch (error) {
                alert("Ошибка, попробуйте позже");
            } finally {
                button.dataset.voting = "false";
                button.disabled = false;
            }
        });
    });

    const voteButton = document.getElementById("vote-btn");
    const votesCount = document.getElementById("votes-count");
    const voteMessage = document.getElementById("vote-message");

    if (!voteButton) {
        return;
    }

    voteButton.type = "button";
    unlockVoteButton(voteButton);

    if (voteButton.disabled && (voteButton.textContent.includes("Войти") || voteButton.textContent.includes("Log in"))) {
        voteButton.disabled = false;
        voteButton.addEventListener("click", () => {
            window.location.href = `/login/?next=${encodeURIComponent(window.location.pathname)}`;
        });
        return;
    }

    if (voteButton.disabled) {
        return;
    }

    voteButton.addEventListener("click", async () => {
        if (voteButton.dataset.voting === "true") {
            return;
        }

        const currentlyVoted = voteButton.dataset.voted === "true";
        voteButton.dataset.voting = "true";
        voteButton.disabled = true;
        voteMessage.textContent = currentlyVoted ? "..." : "...";

        try {
            const { response, data } = await postVote(voteButton.dataset.id);

            if (typeof data.votes === "number" && votesCount) {
                votesCount.textContent = String(data.votes);
            }

            if (response.status === 401) {
                window.location.href = `/login/?next=${encodeURIComponent(window.location.pathname)}`;
                return;
            }

            if (response.ok && data.success) {
                const voted = resolveVotedState(voteButton, data);
                voteButton.dataset.voted = voted ? "true" : "false";
                voteButton.classList.toggle("voted", voted);
                setVoteButtonLabel(voteButton, voted ? LABEL_REMOVE : LABEL_VOTE_DETAIL, !voted);
                voteMessage.textContent = "";
                voteButton.animate(
                    [{ transform: "scale(1)" }, { transform: "scale(1.3)" }, { transform: "scale(1)" }],
                    { duration: 230 }
                );
                return;
            }

            alert(data.error || "Ошибка, попробуйте позже");
            voteMessage.textContent = data.error || "";
        } catch (error) {
            alert("Ошибка, попробуйте позже");
            voteMessage.textContent = "";
        } finally {
            voteButton.dataset.voting = "false";
            voteButton.disabled = false;
        }
    });
})();
