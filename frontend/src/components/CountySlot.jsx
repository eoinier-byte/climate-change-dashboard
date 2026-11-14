// A reserved place on the county page for a block another story will build (CCD-180).
// Fill it by putting the block inside: <CountySlot ...><WarmingStripes /></CountySlot>
// so the block can be added without changing the rest of the page.
// Props:
//   name     - short id, used for the HTML id and data-slot, e.g. "stripes"
//   title    - the section heading, e.g. "Warming stripes"
//   story    - the Jira story that will fill it, e.g. "CCD-374"
//   children - the block itself (leave empty until it's built)
//
// While a slot is empty:
//   - in development (npm run dev) it shows a dashed box saying what will go there,
//     so the team can see the layout
//   - on the real site (npm run build) it shows nothing, so visitors never see "coming soon" boxes
export default function CountySlot({ name, title, story, children }) {
  const headingId = `${name}-heading`;

  if (!children) {
    // import.meta.env.DEV is true under "npm run dev" and "npm test", false in a production build
    if (!import.meta.env.DEV) return null;

    return (
      <section className="county-slot county-slot--empty" data-slot={name} aria-labelledby={headingId}>
        <h2 id={headingId}>{title}</h2>
        <p>
          Reserved for {story}. Only shown while developing.
        </p>
      </section>
    );
  }

  return (
    <section className="county-slot" data-slot={name} aria-labelledby={headingId}>
      <h2 id={headingId}>{title}</h2>
      {children}
    </section>
  );
}