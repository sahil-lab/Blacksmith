/** Pulls an element slightly toward the pointer while it is hovered. */
export function attachMagnet(element: HTMLElement, strength = 0.26): () => void {
  const onMove = (event: PointerEvent) => {
    if (event.pointerType === "touch") {
      return;
    }
    const rect = element.getBoundingClientRect();
    const x = (event.clientX - (rect.left + rect.width / 2)) * strength;
    const y = (event.clientY - (rect.top + rect.height / 2)) * strength;
    element.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
  };
  const onLeave = () => {
    element.style.transform = "";
  };
  element.addEventListener("pointermove", onMove);
  element.addEventListener("pointerleave", onLeave);
  return () => {
    element.removeEventListener("pointermove", onMove);
    element.removeEventListener("pointerleave", onLeave);
    element.style.transform = "";
  };
}
