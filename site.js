(() => {
  const path = location.pathname.split("/").pop() || "index.html";
  document.querySelectorAll(".topnav a[href]").forEach(link => {
    const target = new URL(link.href, location.href).pathname.split("/").pop();
    const parent = document.body.dataset.parent;
    const current = target === path || (path.startsWith("archivo-") && target === parent);
    link.classList.toggle("active", current);
    if (current) link.setAttribute("aria-current", "page");
  });
  document.documentElement.classList.add("page-enter");
  document.querySelectorAll('a[href$=".html"]').forEach(link => {
    link.addEventListener("click", event => {
      const target = new URL(link.href, location.href);
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || target.origin !== location.origin || target.pathname === location.pathname) return;
      event.preventDefault();
      document.documentElement.classList.add("page-leaving");
      setTimeout(() => location.href = target.href, 150);
    });
  });
})();
