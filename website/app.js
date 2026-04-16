const revealItems = document.querySelectorAll("[data-reveal]");

if (revealItems.length) {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    {
      root: null,
      threshold: 0.16
    }
  );

  revealItems.forEach((item) => observer.observe(item));
}

const nav = document.querySelector(".nav");
const menuToggle = document.querySelector(".menu-toggle");

if (menuToggle && nav) {
  menuToggle.addEventListener("click", () => {
    nav.classList.toggle("is-open");
  });

  nav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      nav.classList.remove("is-open");
    });
  });
}

const activePath = window.location.pathname.split("/").pop() || "index.html";
const navLinks = document.querySelectorAll(".nav a[data-page]");

navLinks.forEach((link) => {
  const target = link.getAttribute("data-page");

  if (!target) {
    return;
  }

  if (target === activePath || (target === "index.html" && activePath === "")) {
    link.classList.add("is-active");
  }
});

const tiltCards = document.querySelectorAll(".tilt");
const maxTilt = 6;
const canHover = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

if (canHover) {
  tiltCards.forEach((card) => {
    card.addEventListener("mousemove", (event) => {
      const bounds = card.getBoundingClientRect();
      const offsetX = event.clientX - bounds.left;
      const offsetY = event.clientY - bounds.top;
      const percentX = offsetX / bounds.width - 0.5;
      const percentY = offsetY / bounds.height - 0.5;
      const rotateY = percentX * maxTilt;
      const rotateX = -percentY * maxTilt;
      card.style.transform = `perspective(900px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg)`;
    });

    card.addEventListener("mouseleave", () => {
      card.style.transform = "";
    });
  });
}
