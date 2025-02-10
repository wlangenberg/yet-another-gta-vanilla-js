class Toast {
    constructor() {
        this.init();
    }

    init() {
        if (!document.getElementById("toastContainer")) {
            const container = document.createElement("div");
            container.id = "toastContainer";
            document.body.appendChild(container);
        }
    }

    show(message, duration = 3000) {
        const toastContainer = document.getElementById("toastContainer");
        const toast = document.createElement("div");
        toast.classList.add("toast");
        toast.innerText = message;

        toastContainer.appendChild(toast);

        // Show the toast
        setTimeout(() => {
            toast.classList.add("show");
        }, 100);

        // Remove the toast after duration
        setTimeout(() => {
            toast.classList.remove("show");
            setTimeout(() => toast.remove(), 500); // Remove from DOM after animation
        }, duration);
    }
}

// Export a singleton instance
const toast = new Toast();
export default toast;
